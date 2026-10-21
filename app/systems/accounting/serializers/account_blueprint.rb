# app/systems/accounting/serializers/account_blueprint.rb
module Accounting
  class AccountBlueprint < Blueprinter::Base
    identifier :id
    fields :code, :contra_for_id, :name, :ledger_id, :accepts_other_currencies,
           :allowed_center_types_1, :allowed_center_types_2, :allowed_center_types_3,
           :allowed_center_types_4, :allowed_center_types_5, :allowed_center_types_6,
           :fx_gain_account_id, :fx_loss_account_id
    field :translations_hash, name: :t

    field :full_code

    # Only for a single account (edit form): whether "accepts other
    # currencies" can be turned off.
    view :show do
      field :has_foreign_currency_items do |account|
        account.foreign_currency_items?
      end
    end
  end
end
