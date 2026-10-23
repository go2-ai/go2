class ReportTemplatesController < ApplicationController
  before_action :set_organization
  before_action :set_template, only: [ :show, :update, :destroy ]

  # The list omits template_file (templates can be large); fetch a single
  # template to get its content. Only reports the member may print are listed.
  def index
    authorize ReportTemplate

    templates = policy_scope(ReportTemplate).includes(:created_by).order(:report_key, :locale, :id)
    templates = templates.where(report_key: params[:report_key]) if params[:report_key].present?

    render json: ReportTemplateBlueprint.render(templates, view: :index, access: access), status: :ok
  end

  def show
    authorize @template

    render json: ReportTemplateBlueprint.render(@template, view: :show, access: access, organization: @organization), status: :ok
  end

  # New templates are always copies of an existing template (system or the
  # organization's own). Layout and report key come from the source template;
  # the locale too, unless one of the organization's locales is given.
  def create
    source = policy_scope(ReportTemplate).find_by(id: params[:parent_template_id])
    return render json: { errors: [ controller_t("errors.source_not_found") ] }, status: :not_found unless source

    locale = params[:locale].presence&.to_s
    if locale && !@organization.available_locales.map(&:to_s).include?(locale)
      return render json: { errors: [ controller_t("errors.locale_not_available") ] }, status: :unprocessable_content
    end

    template = source.build_copy(organization: @organization, created_by: current_member, name: name_param, locale: locale)
    authorize template

    if template.save
      render json: ReportTemplateBlueprint.render(template, view: :show, access: access, organization: @organization), status: :ok
    else
      render json: { errors: template.errors.full_messages }, status: :unprocessable_content
    end
  end

  def update
    authorize @template

    @template.assign_attributes(params.permit(:template_file))
    @template.write_attribute(:name, (@template.read_attribute(:name) || {}).merge(name_param)) if name_param.present?

    if @template.save
      render json: ReportTemplateBlueprint.render(@template, view: :show, access: access, organization: @organization), status: :ok
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
    render json: { errors: [ controller_t("errors.organization_not_found") ] }, status: :not_found unless @organization
  end

  def set_template
    @template = policy_scope(ReportTemplate).find_by(id: params[:id])
    render json: { errors: [ controller_t("errors.not_found") ] }, status: :not_found unless @template
  end

  # What the current user may do per report (same rules as ReportTemplatePolicy).
  def access
    @access ||= ReportRegistry.access(current_user, @organization)
  end

  # Translated names, limited to the organization's locales: { "en" => "...", "fa" => "..." }
  def name_param
    @name_param ||= begin
      names = params[:name].respond_to?(:permit) ? params[:name].permit(*@organization.available_locales).to_h : {}
      names.transform_values { |value| value.to_s.strip }.reject { |_, value| value.blank? }
    end
  end
end
