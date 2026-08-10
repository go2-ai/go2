class GroupsController < ApplicationController
  
  before_action :authorize_user!
  before_action :set_group, only: %i[show update destroy]

  def index
    groups = current_organization.groups.includes([ members: :user ])
    render json: GroupBlueprint.render(groups), status: :ok
  end

  def show
    render json: GroupBlueprint.render(@group), status: :ok
  end

  def create
    group = current_organization.groups.new(permitted_params)

    if group.save
      render json: GroupBlueprint.render(group), status: :ok
    else
      render json: { errors: group.errors.full_messages }, status: :unprocessable_content
    end
  end

  def update
    if @group.update(permitted_params)
      render json: GroupBlueprint.render(@group)
    else
      render json: { errors: @group.errors.full_messages }, status: :unprocessable_content
    end
  end

  def destroy
    if @group.destroy
      render json: GroupBlueprint.render(@group), status: :ok
    else
      render json: { errors: @group.errors.full_messages }, status: :unprocessable_content
    end
  end

  def export
    authorize current_member
    @groups = current_organization.groups.includes(:members).order(:name)
    respond_to do |format|
      format.xlsx do
        response.headers["Content-Disposition"] = "attachment; filename=groups_#{current_organization.name.parameterize}_#{Date.current}.xlsx"
      end
    end
  end

  private

  def authorize_user!
    authorize current_organization, :administrate?
  end

  def set_group
    @group = current_organization.groups.find_by_id(params[:id])
    return if @group
    render json: { errors: controller_t("not_found") }, status: :not_found
  end

  def permitted_params
    params.permit(:organization_id, *t_params(:name), *t_params(:description), member_ids: [])
  end
end
