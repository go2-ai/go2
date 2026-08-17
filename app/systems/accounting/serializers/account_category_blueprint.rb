# app/systems/accounting/serializers/account_category_blueprint.rb
module Accounting
  class AccountCategoryBlueprint < Blueprinter::Base
    identifier :id
    fields :code, :identifier, :type, :name
    field :translations_hash, name: :t
  end
end
