module Accounting
  class AccountCategoryPolicy < ApplicationPolicy
    def index?
      view_accounts?
    end

    def show?
      view_accounts?
    end

    def create?
      manage_accounts?
    end

    def update?
      manage_accounts?
    end

    def destroy?
      manage_accounts?
    end

    private

    def manage_accounts?
      member = user.member(organization)
      member&.has_permission?(Permission::ACCOUNTING_MANAGE_ACCOUNTS)
    end

    def view_accounts?
      member = user.member(organization)
      member&.has_permission?(Permission::ACCOUNTING_VIEW_ACCOUNTS)
    end
  end
end