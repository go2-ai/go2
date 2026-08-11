# app/systems/accounting/serializers/center_blueprint.rb
module Accounting
  class CenterBlueprint < Blueprinter::Base
    identifier :id
    fields :code, :centerable_type, :centerable_id, :name
    field :translations_hash, name: :t

    view :index do
      association :center_type, blueprint: Accounting::CenterTypeBlueprint
    end

    view :show do
      field :metadata
      association :center_type, blueprint: Accounting::CenterTypeBlueprint
    end
  end
end
