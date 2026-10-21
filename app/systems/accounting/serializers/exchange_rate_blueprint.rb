module Accounting
  class ExchangeRateBlueprint < Blueprinter::Base
    identifier :id

    fields :currency_id, :quote_currency_id, :date, :source, :meta, :created_by_id, :created_at, :updated_at

    # Decimal string to keep full precision.
    field :rate do |rate|
      rate.rate.to_s("F")
    end
  end
end
