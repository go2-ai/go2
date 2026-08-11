module Accounting
  class CurrencyBlueprint < Blueprinter::Base
    identifier :id
    fields :abr, :decimal_digits, :name
    field :translations_hash, name: :t
  end
end
