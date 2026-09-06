class ReportTemplatesController < ApplicationController
  before_action :set_organization

  def index
    templates = ReportTemplate.for_organization(@organization.id).order(:report_key, :name)
    render json: ReportTemplateBlueprint.render(templates), status: :ok
  end

  def show
    template = ReportTemplate.for_organization(@organization.id).find_by_id(params[:id])
    return render json: { errors: [ "Report template not found" ] }, status: :not_found unless template

    render json: ReportTemplateBlueprint.render(template), status: :ok
  end

  def create
    template = @organization.report_templates.new(permitted_params)
    template.created_by = current_member

    if template.save
      render json: ReportTemplateBlueprint.render(template), status: :ok
    else
      render json: { errors: template.errors.full_messages }, status: :unprocessable_content
    end
  end

  def update
    template = ReportTemplate.for_organization(@organization.id).find_by_id(params[:id])
    return render json: { errors: [ "Report template not found" ] }, status: :not_found unless template

    if template.update(permitted_params)
      render json: ReportTemplateBlueprint.render(template), status: :ok
    else
      render json: { errors: template.errors.full_messages }, status: :unprocessable_content
    end
  end

  def destroy
    template = ReportTemplate.for_organization(@organization.id).find_by_id(params[:id])
    return render json: { errors: [ "Report template not found" ] }, status: :not_found unless template

    if template.destroy
      render json: ReportTemplateBlueprint.render(template), status: :ok
    else
      render json: { errors: template.errors.full_messages }, status: :unprocessable_content
    end
  end

  private

  def set_organization
    @organization = Organization.find_by(id: params[:organization_id])
    render json: { errors: [ "Organization not found" ] }, status: :not_found unless @organization
  end

  def permitted_params
    params.permit(:report_key, :template_file, :parent_template_id, :is_default, name: {})
  end
end
