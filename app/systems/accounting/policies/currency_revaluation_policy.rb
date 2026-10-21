# app/systems/accounting/policies/currency_revaluation_policy.rb
module Accounting
  class CurrencyRevaluationPolicy < ApplicationPolicy
    def index?
      view?
    end

    def show?
      view?
    end

    def create?
      revalue?
    end

    def update?
      revalue?
    end

    def rebuild?
      revalue?
    end

    def post_entry?
      revalue?
    end

    def change_kind?
      revalue?
    end

    def destroy?
      revalue?
    end

    private

    def member
      @member ||= user.member(organization)
    end

    def revalue?
      member&.has_permission?(Permission::ACCOUNTING_REVALUE_CURRENCIES) || false
    end

    # Revaluations and their entries are visible to whoever can see journal entries.
    def view?
      revalue? ||
        member&.has_permission?(Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES) ||
        member&.has_permission?(Permission::ACCOUNTING_MANAGE_JOURNAL_ENTRIES) ||
        member&.has_permission?(Permission::ACCOUNTING_APPROVE_JOURNAL_ENTRIES) || false
    end
  end
end
