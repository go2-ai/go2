# app/systems/accounting/services/exchange_rates/resolver.rb
module Accounting
  module ExchangeRates
    # Resolves the rate of a currency in the organization's main currency on
    # a date: 1 unit of the currency = `rate` units of the main currency.
    #
    # For each currency the latest stored rate dated on or before the date
    # is used; on the same date a manual rate wins over provider rates. A
    # rate quoted in another currency is multiplied by that currency's own
    # resolved rate (cross rate), e.g. EUR→USD (ECB) × USD→IRR (manual).
    class Resolver
      # rate:      BigDecimal, in the main currency
      # rate_date: the oldest date of the rates used (how stale it is)
      # path:      the stored rates used, from the currency to the main one
      Result = Struct.new(:currency_id, :rate, :rate_date, :path, keyword_init: true) do
        def sources
          path.map(&:source).uniq
        end
      end

      def initialize(organization:, date:)
        @organization = organization
        @date = date
        @cache = {}
        @errors = {}
      end

      attr_reader :organization, :date

      # Result for the currency (record or id), or nil when no rate is
      # available. #error_for explains why.
      def resolve(currency)
        currency_id = currency.respond_to?(:id) ? currency.id : currency
        return @cache[currency_id] if @cache.key?(currency_id)

        result, error = compute(currency_id, [])
        @errors[currency_id] = error if error
        @cache[currency_id] = result
      end

      # Results for several currencies, keyed by currency id.
      def resolve_all(currencies)
        Array(currencies).to_h do |currency|
          id = currency.respond_to?(:id) ? currency.id : currency
          [ id, resolve(id) ]
        end
      end

      # :missing or :cycle for currencies that could not be resolved.
      def error_for(currency)
        currency_id = currency.respond_to?(:id) ? currency.id : currency
        resolve(currency_id)
        @errors[currency_id]
      end

      def main_currency_id
        @main_currency_id ||= organization.accounting_setting&.main_currency_id
      end

      private

      # Returns [result, error]; error is :missing or :cycle when result is nil.
      def compute(currency_id, visiting)
        return [ main_result, nil ] if currency_id == main_currency_id
        return [ nil, :cycle ] if visiting.include?(currency_id)

        stored = latest_rate(currency_id)
        return [ nil, :missing ] unless stored

        quote, error = compute(stored.effective_quote_currency_id, visiting + [ currency_id ])
        return [ nil, error ] unless quote

        result = Result.new(
          currency_id: currency_id,
          rate: stored.rate * quote.rate,
          rate_date: [ stored.date, quote.rate_date ].compact.min,
          path: [ stored, *quote.path ]
        )
        [ result, nil ]
      end

      def main_result
        Result.new(currency_id: main_currency_id, rate: BigDecimal("1"), rate_date: nil, path: [])
      end

      # Latest rate on or before the date; on the same date, manual first.
      def latest_rate(currency_id)
        Accounting::ExchangeRate
          .where(organization_id: organization.id, currency_id: currency_id)
          .on_or_before(date)
          .order(date: :desc)
          .order(Arel.sql("CASE WHEN source = '#{Accounting::ExchangeRate::MANUAL}' THEN 0 ELSE 1 END"))
          .order(id: :desc)
          .first
      end
    end
  end
end
