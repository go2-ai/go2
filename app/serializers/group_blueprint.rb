class GroupBlueprint < Blueprinter::Base
  identifier :id
  fields :name, :description
  association :members, blueprint: MemberBlueprint, view: :index
  field :translations_hash, name: :t
end
