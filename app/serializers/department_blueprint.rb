class DepartmentBlueprint < Blueprinter::Base
  identifier :id
  fields :name, :description, :abbreviation
  field :translations_hash, name: :t
end
