class FiscalYearBlueprint < Blueprinter::Base
  identifier :id

  fields :name, :start_date, :finish_date

  field :translations_hash, name: :t
end
