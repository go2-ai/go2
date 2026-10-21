module Accounting
  class Setting < ApplicationRecord
    include TranslationHelper
    has_paper_trail

    self.table_name = "accounting_settings"

    belongs_to :organization
    belongs_to :main_currency, class_name: "Currency", optional: true

    # ── Fiscal year closing ───────────────────────────────────────────────
    # How revenues and expenses are closed at year end:
    #   direct:              straight to retained earnings (one entry)
    #   income_summary:      to income summary, then its net to retained
    #                        earnings (two entries)
    #   current_year_profit: to a current year profit equity account; moving
    #                        it to retained earnings is left to the users
    # validate: true turns unknown values into validation errors.
    enum :closing_method, { direct: 0, income_summary: 1, current_year_profit: 2 }, prefix: :closing, validate: true

    belongs_to :retained_earnings_account, class_name: "Accounting::Account", optional: true
    belongs_to :income_summary_account, class_name: "Accounting::Account", optional: true
    belongs_to :current_year_profit_account, class_name: "Accounting::Account", optional: true

    # ── Currency revaluation ──────────────────────────────────────────────
    # Defaults; ledgers and accounts can override them.
    belongs_to :default_fx_gain_account, class_name: "Accounting::Account", optional: true
    belongs_to :default_fx_loss_account, class_name: "Accounting::Account", optional: true

    validates :organization_id, uniqueness: true
    validates :closing_method, presence: true
    validate :closing_accounts_valid
    validate :closing_accounts_distinct
    validate :revaluation_line_templates_valid
    validate :closing_line_templates_valid

    # Accounts the closing method needs, by attribute.
    REQUIRED_CLOSING_ACCOUNTS = {
      "direct" => %i[retained_earnings_account],
      "income_summary" => %i[income_summary_account retained_earnings_account],
      "current_year_profit" => %i[current_year_profit_account]
    }.freeze

    # Messages for what is missing to close a fiscal year with the current
    # settings (empty when ready). Checked when closing starts, not on save,
    # so settings can be filled in gradually.
    def closing_configuration_errors
      REQUIRED_CLOSING_ACCOUNTS.fetch(closing_method, []).filter_map do |attribute|
        next if public_send(attribute).present?

        model_t("errors.closing_account_required",
                account: model_t("closing_accounts.#{attribute}"),
                method: model_t("closing_methods.#{closing_method}"))
      end
    end

    # Snapshot stored on the fiscal year when closing starts, so later
    # settings changes don't affect a closing in progress.
    def closing_snapshot
      {
        "closing_method" => closing_method,
        "retained_earnings_account_id" => retained_earnings_account_id,
        "income_summary_account_id" => income_summary_account_id,
        "current_year_profit_account_id" => current_year_profit_account_id
      }
    end

    private

    def closing_line_templates_valid
      Accounting::Closing::LineDescriptions.validate(self, :closing_line_description_templates, closing_line_description_templates)
    end

    def revaluation_line_templates_valid
      Accounting::Revaluation::LineDescriptions.validate(self, :revaluation_line_description_template,
                                                         revaluation_line_description_template, "item")
      Accounting::Revaluation::LineDescriptions.validate(self, :revaluation_counter_line_description_template,
                                                         revaluation_counter_line_description_template, "counter")
    end

    def closing_accounts_valid
      check = lambda do |attribute, rule|
        account = public_send(attribute)
        next if account.nil?

        error = Accounting::ClosingAccounts.public_send(rule, account, organization)
        errors.add(:"#{attribute}_id", model_t("errors.#{error}")) if error
      end

      check.call(:retained_earnings_account, :equity_account_error)
      check.call(:current_year_profit_account, :equity_account_error)
      check.call(:income_summary_account, :income_summary_error)
      check.call(:default_fx_gain_account, :fx_account_error)
      check.call(:default_fx_loss_account, :fx_account_error)
    end

    def closing_accounts_distinct
      ids = {
        retained_earnings_account_id: retained_earnings_account_id,
        income_summary_account_id: income_summary_account_id,
        current_year_profit_account_id: current_year_profit_account_id
      }.compact
      ids.group_by { |_, id| id }.each_value do |pairs|
        next if pairs.size < 2

        pairs.drop(1).each { |attribute, _| errors.add(attribute, model_t("errors.closing_accounts_distinct")) }
      end
    end
  end
end
