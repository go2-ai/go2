module Accounting
  # Errors of running a report over a period, rendered as 422:
  # periods outside the fiscal years (Explorer::InvalidScopeError) and
  # dates that don't parse.
  module ReportRunErrors
    extend ActiveSupport::Concern

    included do
      rescue_from "Accounting::Explorer::InvalidScopeError" do |error|
        render_run_error(I18n.t("controllers.journal_entry_items.#{error.key}", **error.options))
      end
      rescue_from Date::Error do
        render_run_error(I18n.t("controllers.journal_entry_items.invalid_date"))
      end
    end

    private

    def render_run_error(message)
      render json: { errors: [ message ] }, status: :unprocessable_content
    end
  end
end
