module Accounting
  class ExchangeRateSourceBlueprint < Blueprinter::Base
    identifier :id

    fields :currency_id, :provider, :quote_currency_id, :active
  end
end
