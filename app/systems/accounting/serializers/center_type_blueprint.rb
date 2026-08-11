# app/systems/accounting/serializers/center_type_blueprint.rb
module Accounting
  class CenterTypeBlueprint < Blueprinter::Base
    identifier :id
    fields :first_code, :last_code, :auto_increment, :metadata, :name
    field :translations_hash, name: :t
  end
end
