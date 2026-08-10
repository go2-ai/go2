class OrganizationBlueprint < Blueprinter::Base
  identifier :id

  view :basic do
    fields :name, :locale, :active_locales, :parent_id
    field :translations_hash, name: :t
  end
end
