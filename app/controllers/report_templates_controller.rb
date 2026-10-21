class ReportTemplatesController < ApplicationController
  before_action :set_organization
  before_action :set_template, only: [ :show, :update, :destroy ]

  # The list omits template_file (templates can be large); fetch a single
  # template to get its content.
  def index
    authorize ReportTemplate

    templates = policy_scope(ReportTemplate).includes(:created_by).order(:report_key, :id)
    templates = templates.where(report_key: params[:report_key]) if params[:report_key].present?

    render json: ReportTemplateBlueprint.render(templates, view: :index, can_manage: can_manage?), status: :ok
  end

  def show
    authorize @template

    render json: ReportTemplateBlueprint.render(@template, view: :show, can_manage: can_manage?, organization: @organization), status: :ok
  end

  # New templates are always copies of an existing template (system or the
  # organization's own). Layout and report key come from the source template.
  def create
    source = policy_scope(ReportTemplate).find_by(id: params[:parent_template_id])
    return render json: { errors: [ "Source report template not found" ] }, status: :not_found unless source

    template = source.build_copy(organization: @organization, created_by: current_member, name: name_param)
    authorize template

    if template.save
      render json: ReportTemplateBlueprint.render(template, view: :show, can_manage: can_manage?, organization: @organization), status: :ok
    else
      render json: { errors: template.errors.full_messages }, status: :unprocessable_content
    end
  end

  def update
    authorize @template

    @template.assign_attributes(params.permit(:template_file, :is_default))
    @template.write_attribute(:name, (@template.read_attribute(:name) || {}).merge(name_param)) if name_param.present?

    if @template.save
      render json: ReportTemplateBlueprint.render(@template, view: :show, can_manage: can_manage?, organization: @organization), status: :ok
    else
      render json: { errors: @template.errors.full_messages }, status: :unprocessable_content
    end
  end

  def destroy
    authorize @template

    if @template.destroy
      head :no_content
    else
      render json: { errors: @template.errors.full_messages }, status: :unprocessable_content
    end
  end

  private

  def set_organization
    @organization = current_organization
    render json: { errors: [ "Organization not found" ] }, status: :not_found unless @organization
  end

  def set_template
    @template = policy_scope(ReportTemplate).find_by(id: params[:id])
    render json: { errors: [ "Report template not found" ] }, status: :not_found unless @template
  end

  # Whether the current user may create, change and delete the organization's
  # templates (same rule as ReportTemplatePolicy; GO3 admins bypass authorize).
  def can_manage?
    return @can_manage if defined?(@can_manage)

    @can_manage = current_user.is_go3_admin? ||
      policy(ReportTemplate.new(organization: @organization)).create?
  end

  # Translated names, limited to the organization's locales: { "en" => "...", "fa" => "..." }
  def name_param
    @name_param ||= begin
      names = params[:name].respond_to?(:permit) ? params[:name].permit(*@organization.available_locales).to_h : {}
      names.transform_values { |value| value.to_s.strip }.reject { |_, value| value.blank? }
    end
  end
end
