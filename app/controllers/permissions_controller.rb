# app/controllers/permissions_controller.rb
class PermissionsController < ApplicationController
  before_action :set_organization

  def grantable
    render json: Permission.grantable_permissions
  end

  def index
    puts params
    @permissions = @organization.permissions

    if params[:code].present?
      @permissions = @permissions.where(code: params[:code])
    end

    if params[:member_id].present?
      member = @organization.members.find(params[:member_id])

      if params[:include_indirect] == "true"
        @permissions = member.all_permissions
      else
        @permissions = Permission.where(grantee: member)
      end
    end

    render json: PermissionBlueprint.render(@permissions)
  end

  def create
    permission = @organization.permissions.new(
      code: params[:code],
      grantee_type: params[:grantee_type],
      grantee_id: params[:grantee_id]
    )

    if permission.save
      render json: PermissionBlueprint.render(permission), status: :ok
    else
      render json: { errors: permission.errors.full_messages }, status: :unprocessable_entity
    end
  end

  def destroy
    permission = @organization.permissions.find(params[:id])
    permission.destroy
    render json: PermissionBlueprint.render(permission), status: :ok
  end

  private

  def set_organization
    @organization = Organization.find(params[:organization_id])
    authorize @organization, :administrate?
  end
end
