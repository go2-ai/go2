# app/systems/accounting/models/fx_account_overrides.rb
module Accounting
  # FX gain/loss account overrides on ledgers and accounts. Revaluation
  # resolves them as account > ledger > accounting settings default.
  module FxAccountOverrides
    extend ActiveSupport::Concern

    included do
      belongs_to :fx_gain_account, class_name: "Accounting::Account", optional: true
      belongs_to :fx_loss_account, class_name: "Accounting::Account", optional: true

      validate :fx_accounts_are_income_statement_accounts
    end

    private

    def fx_accounts_are_income_statement_accounts
      { fx_gain_account_id: fx_gain_account, fx_loss_account_id: fx_loss_account }.each do |attribute, account|
        next if account.nil?

        message = Accounting::ClosingAccounts.fx_account_error(account, organization)
        errors.add(attribute, Accounting::Setting.model_t("errors.#{message}")) if message
      end
    end
  end
end
