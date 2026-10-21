# app/systems/accounting/policies/exchange_rate_policy.rb
module Accounting
  # Exchange rates and their sources.
  class ExchangeRatePolicy < ApplicationPolicy
    def index?
      view?
    end

    def show?
      view?
    end

    def resolve?
      view?
    end

    def create?
      manage?
    end

    def update?
      manage?
    end

    def destroy?
      manage?
    end

    # Fetching rates from providers.
    def fetch?
      manage?
    end

    private

    def member
      @member ||= user.member(organization)
    end

    def view?
      member&.has_permission?(Permission::ACCOUNTING_VIEW_EXCHANGE_RATES) || manage? || false
    end

    def manage?
      member&.has_permission?(Permission::ACCOUNTING_MANAGE_EXCHANGE_RATES) || false
    end
  end
end
