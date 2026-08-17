# app/systems/accounting/serializers/ledger_blueprint.rb
module Accounting
  class LedgerBlueprint < Blueprinter::Base
    identifier :id
    fields :code, :unexpected_balance, :is_monetary, :contra_for_id, :name
    field :translations_hash, name: :t

    view :index do
      association :account_category, blueprint: Accounting::AccountCategoryBlueprint
      field :accounts_count do |ledger|
        ledger.accounts.count
      end
    end

    view :show do
      association :account_category, blueprint: Accounting::AccountCategoryBlueprint
      field :balance_type do |ledger|
        ledger.balance_type
      end
    end
  end
end