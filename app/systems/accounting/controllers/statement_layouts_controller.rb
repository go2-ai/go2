module Accounting
  # The lines, rules and mapping inspection of a statement report.
  class StatementLayoutsController < ApplicationController
    include StatementReportContext
    include ReportRunErrors
    def show
      authorize @report, :show?
      render json: layout_json.merge(can_edit: report_access.can_edit?(@report),
                                     can_edit_mapping: report_access.can_edit_mapping?(@report),
                                     can_inspect: report_access.can_inspect?(@report)), status: :ok
    end

    # Every balance of one column with the line it is reflected in.
    # Shows all accounts, so it needs manage_statements or the journal entry
    # viewing permissions (a grant on one report doesn't reveal the ledger).
    #
    # params: column (current | previous), the run params (date, from, to,
    # approved_only), and optionally proposed_rules (JSON array of rule
    # attributes, see Statements::ProposedRules) to preview changes.
    def inspection
      authorize @report, :show?
      unless report_access.can_inspect?(@report)
        return render json: { errors: [ controller_t("errors.inspection_not_allowed") ] },
                      status: :forbidden
      end

      columns = Accounting::Statements::ReportType.columns(@report, @organization, params)
      column = columns.find { |c| c.key == (params[:column].presence || "current") } || columns.first
      proposed = params[:proposed_rules].present? ? Accounting::Statements::ProposedRules.parse(@layout, params[:proposed_rules]) : nil
      payload = Accounting::Statements::Inspection.new(
        report: @report, organization: @organization, column: column, proposed_rules: proposed,
        approved_only: Accounting::Reports::RunParams.approved_only?(params)
      ).call
      render json: payload, status: :ok
    rescue Accounting::Statements::ProposedRules::Invalid => e
      render json: { errors: e.messages }, status: :unprocessable_content
    end
  end
end
