module Accounting
  # Amounts of an organization's reports: rounded to the main currency's
  # decimals and sent as decimal strings.
  class MoneyFormat
    DEFAULT_DIGITS = 2

    attr_reader :currency

    def initialize(organization)
      @currency = organization&.accounting_setting&.main_currency
    end

    def digits
      currency&.decimal_digits || DEFAULT_DIGITS
    end

    # nil stays nil.
    def amount(value)
      value.nil? ? nil : BigDecimal(value.to_s).round(digits).to_s("F")
    end

    # Differences below half the smallest unit are rounding, not errors.
    def tolerance
      BigDecimal("0.5") / (10**digits)
    end

    def currency_json
      { abr: currency&.abr, decimal_digits: digits }
    end
  end
end
