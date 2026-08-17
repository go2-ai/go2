# app/systems/accounting/serializers/ledger_blueprint.rb
module Accounting
  class LedgerBlueprint < Blueprinter::Base
    identifier :id
    fields :code, :unexpected_balance, :is_monetary, :contra_for_id, :name, :account_category_id
    field :translations_hash, name: :t

    view :show do
      field :balance_type do |ledger|
        ledger.balance_type
      end
    end
  end
end
