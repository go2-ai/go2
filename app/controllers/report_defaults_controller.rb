# Which template prints a report, and the defaults behind it.
#
#   GET    /organizations/:organization_id/report_defaults?report_key=journal_entry
#   PUT    /organizations/:organization_id/report_defaults
#          { report_key:, report_template_id:, scope: "organization" | "personal" }
#   DELETE /organizations/:organization_id/report_defaults?report_key=&scope=
#
# Every action answers with the resolution (see #resolution_json).
class ReportDefaultsController < ApplicationController
  SCOPES = %w[organization personal].freeze

  before_action :set_organization
  before_action :set_report_key

  def show
    authorize ReportDefault.new(organization: @organization, report_key: @report_key)

    render json: resolution_json, status: :ok
  end

  def update
    return unless (default = find_default)

    authorize default

    template = ReportTemplate.for_organization(@organization.id).find_by(id: params[:report_template_id], report_key: @report_key)
    return render json: { errors: [ controller_t("template_not_found") ] }, status: :not_found unless template

    default.report_template = template
    if default.save
      render json: resolution_json, status: :ok
    else
      render json: { errors: default.errors.full_messages }, status: :unprocessable_content
    end
  end

  def destroy
    return unless (default = find_default)

    authorize default

    default.destroy! if default.persisted?
    render json: resolution_json, status: :ok
  end

  private

  def set_organization
    @organization = current_organization
    render json: { errors: [ controller_t("organization_not_found") ] }, status: :not_found unless @organization
  end

  def set_report_key
    @report_key = params[:report_key].to_s
    return if ReportRegistry.known?(@report_key)

    render json: { errors: [ controller_t("unknown_report") ] }, status: :unprocessable_content
  end

  def member
    return @member if defined?(@member)

    @member = current_member
  end

  # The organization default, or the current member's own one.
  def find_default
    scope = params[:scope].to_s
    unless SCOPES.include?(scope)
      render json: { errors: [ controller_t("invalid_scope") ] }, status: :unprocessable_content
      return
    end

    if scope == "personal"
      # Personal defaults belong to a member (GO3 admins outside the organization have none).
      raise Pundit::NotAuthorizedError unless member

      ReportDefault.find_or_initialize_by(organization: @organization, member: member, report_key: @report_key)
    else
      ReportDefault.find_or_initialize_by(organization: @organization, member: nil, report_key: @report_key)
    end
  end

  def resolution_json
    resolver = ReportTemplates::Resolver.new(organization: @organization, member: member, report_key: @report_key)
    access = ReportRegistry.access(current_user, @organization)

    {
      report_key: @report_key,
      default_template_id: resolver.default_template&.id,
      organization_default_template_id: resolver.organization_default&.id,
      personal_default_template_id: resolver.personal_default&.id,
      locales: resolver.by_locale.map do |locale, template|
        system = resolver.system_for(locale)
        { locale: locale, template_id: template&.id, template_locale: template&.locale,
          system_template_id: system&.id, system_template_locale: system&.locale }
      end,
      can_manage: access.can_manage?(@report_key),
      can_print: access.can_print?(@report_key)
    }
  end
end
