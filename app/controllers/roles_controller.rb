class RolesController < ApplicationController
  before_action :authorize_user!
  before_action :set_role, only: %i[show update destroy]

  def index
    roles = current_organization.roles.includes(:department).includes(member: :user).order(:id)
    render json: RoleBlueprint.render(roles), status: :ok
  end

  def show
    render json: RoleBlueprint.render(@role), status: :ok
  end

  def create
    role = current_organization.roles.new(permitted_params)

    if role.save
      render json: RoleBlueprint.render(role), status: :ok
    else
      render json: { errors: role.errors.full_messages }, status: :unprocessable_content
    end
  end

  def update
    if @role.update(permitted_params)
      render json: RoleBlueprint.render(@role)
    else
      render json: { errors: @role.errors.full_messages }, status: :unprocessable_content
    end
  end

  def destroy
    if @role.destroy
      render json: RoleBlueprint.render(@role), status: :ok
    else
      render json: { errors: @role.errors.full_messages }, status: :unprocessable_content
    end
  end

  # The old member assignment actions are deprecated; handled via create/update.

  def export
    authorize current_member
    @roles = current_organization.roles.includes([ :department, :parent ]).order(:name)
    respond_to do |format|
      format.xlsx do
        response.headers["Content-Disposition"] = "attachment; filename=roles_#{current_organization.name.parameterize}_#{Date.current}.xlsx"
      end
    end
  end

  private

  def authorize_user!
    authorize current_organization, :administrate?
  end

  def set_role
    @role = current_organization.roles.find_by_id(params[:id])
    return if @role
    render json: { errors: controller_t("not_found") }, status: :not_found
  end

  def permitted_params
    params.permit(:parent_id, :department_id, :member_id, :active, *t_params(:name), *t_params(:description))
  end
end
