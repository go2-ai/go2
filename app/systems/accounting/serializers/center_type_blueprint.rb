module Accounting
  class CenterTypeBlueprint < Blueprinter::Base
    identifier :id
    fields :first_code, :last_code, :auto_increment, :metadata, :name
    field :translations_hash, name: :t

    view :index do
      field :centers_count
    end
  end
end
