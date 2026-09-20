# app/controllers/permissions_controller.rb
class PermissionsController < ApplicationController
  before_action :set_organization

  def grantable
    render json: Permission.grantable_permissions
  end

  def index
    @permissions =
      if params[:code].present?
        @organization.permissions.where(code: params[:code])
      elsif params[:member_id].present?
        member = @organization.members.find(params[:member_id])
        if params[:include_indirect] == "true"
          member.all_permissions
        else
          Permission.where(grantee: member)
        end
      else
        @organization.permissions
      end

    render json: PermissionBlueprint.render(@permissions.includes(:grantee))
  end

  def create
    permission = @organization.permissions.new(
      code: params[:code],
      grantee_type: params[:grantee_type],
      grantee_id: params[:grantee_id]
    )

    if permission.save
      grant_prerequisites_for(permission)
      render json: PermissionBlueprint.render(permission), status: :ok
    else
      render json: { errors: permission.errors.full_messages }, status: :unprocessable_entity
    end
  end

  # POST /organizations/:organization_id/permissions/bulk
  def bulk
    grantee_type = params[:grantee_type]
    grantee_id = params[:grantee_id]
    requested_codes = Array(params[:codes])

    if requested_codes.blank?
      return render json: { errors: [ controller_t("codes_is_required") ] }, status: :unprocessable_entity
      # Tech debt: Add translation
    end

    expanded_codes = requested_codes.flat_map { |code| [ code ] + Permission.prerequisites_for(code) }.uniq
    created = []

    ActiveRecord::Base.transaction do
      expanded_codes.each do |code|
        next if @organization.permissions.exists?(
          code: code,
          grantee_type: grantee_type,
          grantee_id: grantee_id
        )

        created << @organization.permissions.create!(
          code: code,
          grantee_type: grantee_type,
          grantee_id: grantee_id
        )
      end
    end

    render json: PermissionBlueprint.render(created), status: :ok
  rescue ActiveRecord::RecordInvalid => e
    render json: { errors: e.record.errors.full_messages }, status: :unprocessable_entity
  rescue StandardError => e
    render json: { errors: [ controller_t("unexpected_error") ] }, status: :internal_server_error
    # Tech debt: Add translation
  end

  def destroy
    permission = @organization.permissions.find(params[:id])

    if self_org_admin_revocation?(permission)
      return render json: { errors: [ controller_t("cant_revoke_own_admin_permission") ] }, status: :forbidden
      # Tech debt: Add translation
    end

    blocking = blocking_dependents_for(permission)
    if blocking.any?
      return render json: { errors: [ blocking_dependents_error_message(blocking) ] }, status: :forbidden
    end

    permission.destroy
    render json: PermissionBlueprint.render(permission), status: :ok
  end

  private

  def set_organization
    @organization = Organization.find(params[:organization_id])
    authorize @organization, :administrate?
  end

  def grant_prerequisites_for(permission)
    Permission.prerequisites_for(permission.code).each do |prereq_code|
      next if @organization.permissions.exists?(
        code: prereq_code,
        grantee_type: permission.grantee_type,
        grantee_id: permission.grantee_id
      )

      @organization.permissions.create(
        code: prereq_code,
        grantee_type: permission.grantee_type,
        grantee_id: permission.grantee_id
      )
    end
  end

  # Returns the codes (already granted to the same grantee) that would be
  # left without their required prerequisite if `permission` were revoked.
  def blocking_dependents_for(permission)
    dependent_codes = Permission.dependents_for(permission.code)
    return [] if dependent_codes.empty?

    @organization.permissions
      .where(code: dependent_codes, grantee_type: permission.grantee_type, grantee_id: permission.grantee_id)
      .pluck(:code)
  end

  def blocking_dependents_error_message(codes)
    names = codes.map { |code| Permission.grantable_permissions.find { |p| p[:code] == code }&.fetch(:name, code) || code }
    "Cannot revoke this permission while the following are still granted to the same grantee: #{names.join(', ')}"
    # Tech debt: Add translation
  end

  def self_org_admin_revocation?(permission)
    permission.code == Permission::ORG_ADMIN &&
      permission.grantee_type == "Member" &&
      current_member.present? &&
      permission.grantee_id == current_member.id
  end
end