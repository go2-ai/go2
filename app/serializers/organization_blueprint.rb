class OrganizationBlueprint < Blueprinter::Base
  identifier :id

  view :basic do
    fields :name, :locale, :active_locales, :parent_id, :calendar_types, :time_zone, :max_file_size, :total_file_size, :max_total_file_size
    field :translations_hash, name: :t
  end
end
