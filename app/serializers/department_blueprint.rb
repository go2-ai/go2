class DepartmentBlueprint < Blueprinter::Base
  identifier :id
  view :index do
    fields :name, :description, :abbreviation
  end

  view :show do
    include_view :index
    field :translations_hash, name: :t
  end
end
