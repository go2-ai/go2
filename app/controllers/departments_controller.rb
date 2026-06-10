class DepartmentsController < ApplicationController
  before_action :authenticate_user!

  def index
    authorize current_organization, :administrate?
    departments = current_organization.departments.order(id: :desc)
    render json: DepartmentBlueprint.render(departments, view: :index), status: :ok
  end

  def show
    authorize current_organization, :administrate?
    department = current_organization.departments.find_by_id(params[:id])
    return render json: { errors: [ controller_t("not_found") ] }, status: :not_found unless department
    # Tech debt: Add translation
    render json: DepartmentBlueprint.render(department, view: :show), status: :ok
  end

  def create
    authorize current_organization, :administrate?
    department = current_organization.departments.new(permitted_params)

    if department.save
      render json: DepartmentBlueprint.render(department, view: :index), status: :ok
    else
      render json: { errors: department.errors.full_messages }, status: :unprocessable_content
    end
  end

  def update
    authorize current_organization, :administrate?
    department = current_organization.departments.find_by(id: params[:id])
    return render json: { errors: [ controller_t("not_found") ] }, status: :not_found unless department
    # Tech debt: Add translation
    if department.update(permitted_params)
      render json: DepartmentBlueprint.render(department, view: :index), status: :ok
    else
      render json: { errors: department.errors.full_messages }, status: :unprocessable_content
    end
  end

  def destroy
    authorize current_organization, :administrate?
    department = current_organization.departments.find_by(id: params[:id])
    return render json: { errors: [ controller_t("not_found") ] }, status: :not_found unless department
    # Tech debt: Add translation
    department.destroy
    render json: DepartmentBlueprint.render(department, view: :index), status: :ok
  end

  private

  def permitted_params
    params.permit(:abbreviation, *t_params(:name), *t_params(:description))
  end
end
