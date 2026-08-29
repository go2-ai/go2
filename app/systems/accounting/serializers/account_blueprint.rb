# app/systems/accounting/serializers/account_blueprint.rb
module Accounting
  class AccountBlueprint < Blueprinter::Base
    identifier :id
    fields :code, :contra_for_id, :name, :ledger_id, :accepts_other_currencies,
           :allowed_center_types_1, :allowed_center_types_2, :allowed_center_types_3,
           :allowed_center_types_4, :allowed_center_types_5, :allowed_center_types_6
    field :translations_hash, name: :t

    field :full_code
  end
end
