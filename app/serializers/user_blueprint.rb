class UserBlueprint < Blueprinter::Base
  identifier :id

  view :show do
    fields :locale
  end
end
