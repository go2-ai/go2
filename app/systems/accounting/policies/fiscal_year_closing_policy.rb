# app/systems/accounting/policies/fiscal_year_closing_policy.rb
module Accounting
  # Closing a fiscal year (and reopening it) needs the close permission.
  # Approving all booked entries additionally needs the approve permission.
  class FiscalYearClosingPolicy < ApplicationPolicy
    def show?
      close?
    end

    def start?
      close?
    end

    def cancel?
      close?
    end

    def renumber?
      close?
    end

    def skip_renumber?
      close?
    end

    def line_templates?
      close?
    end

    def acknowledge_revaluation?
      close?
    end

    def complete_revaluation?
      close?
    end

    def post_temp_closing?
      close?
    end

    def post_ending?
      close?
    end

    def post_beginning?
      close?
    end

    def rollback?
      close?
    end

    def reopen_fully?
      close?
    end

    def approve_all?
      close? && member&.has_permission?(Permission::ACCOUNTING_APPROVE_JOURNAL_ENTRIES) || false
    end

    private

    def member
      @member ||= user.member(organization)
    end

    def close?
      member&.has_permission?(Permission::ACCOUNTING_CLOSE_FISCAL_YEARS) || false
    end
  end
end
