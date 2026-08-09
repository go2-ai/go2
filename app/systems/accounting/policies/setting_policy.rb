module Accounting
  class SettingPolicy < ApplicationPolicy
    def show?
      organization = record.organization
      member = user.member(organization)
      member&.has_permission?(Permission::ACCOUNTING_VIEW_SETTINGS) ||
        member&.has_permission?(Permission::ACCOUNTING_MANAGE_SETTINGS)
    end

    def update?
      organization = record.organization
      member = user.member(organization)
      member&.has_permission?(Permission::ACCOUNTING_MANAGE_SETTINGS)
    end
  end
end