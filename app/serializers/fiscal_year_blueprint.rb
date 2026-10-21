class FiscalYearBlueprint < Blueprinter::Base
  identifier :id

  fields :name, :start_date, :finish_date, :status, :closing_step, :closing_started_at, :closed_at

  field :translations_hash, name: :t
end
