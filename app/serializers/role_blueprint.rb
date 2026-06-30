class RoleBlueprint < Blueprinter::Base
  identifier :id
  fields :name, :description, :active, :department_id, :parent_id
  association :member, blueprint: MemberBlueprint, view: :index
  association :department, blueprint: DepartmentBlueprint
  field :translations_hash, name: :t
end
