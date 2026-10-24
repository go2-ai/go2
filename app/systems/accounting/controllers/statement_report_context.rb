module Accounting
  # Loads the statement report of the request (params[:statement_id]) for the
  # layout editor controllers. Reading needs view access; changes need edit
  # access to an organization report (Reporting::ReportPolicy#update?).
  module StatementReportContext
    extend ActiveSupport::Concern

    included do
      before_action :set_statement_report
    end

    private

    def set_statement_report
      @organization = current_organization
      return render_not_found("organization_not_found") unless @organization

      @report = Reporting::Report.available_to(@organization).find_by(id: params[:statement_id])
      @layout = @report&.statement_layout
      render_not_found("not_found") unless @layout
    end

    def render_not_found(key)
      render json: { errors: [ I18n.t("controllers.reports.errors.#{key}") ] }, status: :not_found
    end

    def report_access
      @report_access ||= Reporting::Access.new(current_user, @organization)
    end

    def render_errors(record)
      render json: { errors: record.errors.full_messages }, status: :unprocessable_content
    end

    def layout_json
      Accounting::Statements::LayoutPayload.new(@layout, organization: @organization).call
    end
  end
end
