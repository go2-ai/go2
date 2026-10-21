# app/systems/accounting/models/fiscal_year_closing.rb
module Accounting
  # The closing of a fiscal year as an authorization subject (Pundit looks up
  # Accounting::FiscalYearClosingPolicy). The state lives on FiscalYear.
  class FiscalYearClosing
    attr_reader :fiscal_year

    delegate :organization, to: :fiscal_year

    def self.model_t(key, **options)
      I18n.t("models.accounting/fiscal_year_closing.#{key}", **options)
    end

    def initialize(fiscal_year)
      @fiscal_year = fiscal_year
    end
  end
end
