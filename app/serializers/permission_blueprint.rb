# app/serializers/permission_blueprint.rb
class PermissionBlueprint < Blueprinter::Base
  identifier :id

  fields :code, :grantee_type, :grantee_id, :organization_id, :created_at, :updated_at

  field :grantee_name do |permission|
    permission.grantee.name
  end
end
