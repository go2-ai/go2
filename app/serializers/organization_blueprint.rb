class OrganizationBlueprint < Blueprinter::Base
  identifier :id

  view :basic do
    fields :name, :locale, :active_locales 
  end
end
