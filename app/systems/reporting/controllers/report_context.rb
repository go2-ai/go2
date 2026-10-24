module Reporting
  # Loads the organization and the report of a Reporting request: the
  # organization's own reports and the system presets (404 otherwise).
  # `report_id_param` names the param holding the report id.
  module ReportContext
    extend ActiveSupport::Concern

    private

    def set_organization
      @organization = current_organization
      render json: { errors: [ I18n.t("controllers.reports.errors.organization_not_found") ] }, status: :not_found unless @organization
    end

    def set_report
      @report = Reporting::Report.available_to(@organization).find_by(id: params[report_id_param])
      render json: { errors: [ I18n.t("controllers.reports.errors.not_found") ] }, status: :not_found unless @report
    end

    def report_id_param
      :id
    end

    def access
      @access ||= Reporting::Access.new(current_user, @organization)
    end
  end
end
