# app/models/concerns/versionable.rb
module Versionable
  extend ActiveSupport::Concern

  included do
    def user
      User.find_by(id: whodunnit)
    end

    def user_display
      return "System" if whodunnit.nil?
      user&.full_name || "Unknown User (ID: #{whodunnit})"
    end

    def changes
      return {} unless object_changes.present?

      if object_changes.is_a?(String)
        JSON.parse(object_changes)
      else
        object_changes
      end
    rescue JSON::ParserError
      {}
    end

    def changed_fields
      changes.keys
    end

    def field_changes(field)
      changes[field]
    end

    def display_changes
      return {} unless object_changes.present?

      changes.map do |field, (old_val, new_val)|
        {
          field: field,
          from: old_val,
          to: new_val,
          field_label: field.humanize
        }
      end
    end

    def record_display_name
      if item.present? && item.respond_to?(:name)
        item.name
      elsif item.present? && item.respond_to?(:title)
        item.title
      else
        "#{item_type} ##{item_id}"
      end
    rescue
      "#{item_type} ##{item_id}"
    end
  end
end
