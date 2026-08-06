# app/serializers/version_blueprint.rb
class VersionBlueprint < Blueprinter::Base
  identifier :id

  fields :event, :created_at, :item_type, :item_id, :whodunnit

  view :extended do
    field :user_display do |version|
      version.user_display
    end

    field :record_display_name do |version|
      version.record_display_name
    end

    field :changes do |version|
      version.display_changes
    end

    field :user_avatar do |version|
      version.user&.avatar_url
    end

    field :user_initial do |version|
      if version.user&.full_name.present?
        version.user.full_name.split.map(&:first).join.upcase
      else
        "?"
      end
    end

    field :object_data do |version|
      if version.event == "destroy" && version.object.present?
        begin
          JSON.parse(version.object)
        rescue JSON::ParserError
          nil
        end
      end
    end
  end

  view :permission_history do
    field :actor_name do |version|
      version.user_display
    end

    field :grantee_type do |version|
      version.metadata["grantee_type"]
    end

    field :grantee_name do |version|
      version.metadata["grantee_type"].constantize.find(version.metadata["grantee_id"]).name
    end
  end
end
