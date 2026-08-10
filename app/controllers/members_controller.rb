class MembersController < ApplicationController
  
  before_action :authorize_user!

  def index
    members = current_organization.members.includes(:user).order(id: :desc)
    render json: MemberBlueprint.render(members, view: :index), status: :ok
  end

  def show
    member = current_organization.members.find_by_id(params[:id])
    render json: { errors: [ controller_t("not_found") ] }, status: :not_found unless member
    # Tech debt: Add translation
    render json: MemberBlueprint.render(member, view: :show), status: :ok
  end

  def create
    member = current_organization.members.new(permitted_params)

    if member.save
      if params[:invite]
        invite(member)
      end

      render json: MemberBlueprint.render(member, view: :index), status: :ok
    else
      render json: { errors: member.errors.full_messages }, status: :unprocessable_content
    end
  end

  def update
    member = Member.find_by(id: params[:id])
    if member.update(permitted_params)
      if params[:invite]
        invite(member)
      end

      render json: MemberBlueprint.render(member, view: :index), status: :ok
    end
  end

  def set_as_admin
    member = Member.find_by(id: params[:id])
    Permission.find_or_create_by(organization: member.organization, grantee: member, code: Permission::ORG_ADMIN)

    render json: MemberBlueprint.render(member, view: :index), status: :ok
  end

  def revoke_admin
    member = Member.find_by(id: params[:id])
    Permission.where(organization: member.organization, grantee: member, code: Permission::ORG_ADMIN).destroy_all

    render json: MemberBlueprint.render(member, view: :index), status: :ok
  end

  def send_invitation
    member = Member.find_by(id: params[:id])
    render json: { errors: controller_t("already_joined") }, status: :unprocessable_content if member.joined_at.present?
    # Tech debt: Add translation
    invite(member)
    render json: MemberBlueprint.render(member, view: :index), status: :ok
  end

  def archive
    member = Member.find_by(id: params[:id])
    member.archive!
    render json: MemberBlueprint.render(member, view: :index), status: :ok
  end

  def unarchive
    member = Member.find_by(id: params[:id])
    member.unarchive!
    render json: MemberBlueprint.render(member, view: :index), status: :ok
  end

  def export
    @members = current_organization.members.to_a.sort_by do |member|
      [
        member.archived? ? 1 : 0,       # unarchived first
        member.org_admin? ? 0 : 1,      # admins first
        -member.created_at.to_i         # newer first
      ]
    end

    respond_to do |format|
      format.xlsx do
        response.headers["Content-Disposition"] = "attachment; filename=members_#{current_organization.name.parameterize}_#{Date.current}.xlsx"
      end
    end
  end

  private

  def invite(member)
    invitation_key = SecureRandom.alphanumeric(10)
    member.update!(
      invited_at: Time.current,
      invitation_key: invitation_key
    )

    MemberMailer.invitation(
      member_id: member.id,
      organization_id: current_organization.id,
      invitation_key: invitation_key,
      locale: member.organization.locale,
      email: member.email
    ).deliver_later
  end

  def authorize_user!
    authorize current_organization, :administrate?
  end

  def permitted_params
    params.permit(:email, :initial, :color, :invitation_key, :invited_at, *t_params(:name))
  end
end
