class MemberBlueprint < Blueprinter::Base
  identifier :id
  view :index

  view :show do
    include_view :index
    fields :locale
  end
end
