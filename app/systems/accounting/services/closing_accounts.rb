# app/systems/accounting/services/closing_accounts.rb
module Accounting
  # Rules for the accounts used by revaluation and fiscal year closing.
  # Each check returns an error key (see models.accounting/setting.errors)
  # or nil when the account is acceptable.
  module ClosingAccounts
    module_function

    def category(account)
      account.ledger&.account_category
    end

    def in_organization?(account, organization)
      organization.present? && category(account)&.organization_id == organization.id
    end

    # FX gain/loss: an income statement (temporary) account.
    def fx_account_error(account, organization)
      return :account_not_in_organization unless in_organization?(account, organization)
      return :must_be_income_statement unless category(account)&.income_statement?

      nil
    end

    # Retained earnings / current year profit: an owners' equity account.
    def equity_account_error(account, organization)
      return :account_not_in_organization unless in_organization?(account, organization)
      return :must_be_owners_equity unless category(account)&.identifier == "OE"

      nil
    end

    # Income summary: a non-monetary account outside the income statement
    # (otherwise it would be closed together with revenues and expenses).
    def income_summary_error(account, organization)
      return :account_not_in_organization unless in_organization?(account, organization)
      return :income_summary_not_income_statement if category(account)&.income_statement?
      return :income_summary_not_monetary if account.ledger&.is_monetary

      nil
    end
  end
end
