# app/systems/accounting/services/exchange_rates/fetcher.rb
module Accounting
  module ExchangeRates
    # Fetches provider rates for an organization's currencies whose active
    # source is that provider and stores them as ExchangeRate rows.
    #
    # ECB quotes everything as "1 EUR = x". The rate of currency X quoted in
    # Q (the source's quote currency, the main currency when blank) is
    # x(Q) / x(X), with x(EUR) = 1. Both currencies must be published by
    # the ECB (matched on ISO code, Currency#abr); otherwise the currency is
    # skipped with a reason. Rates already stored for the same currency,
    # date and source are updated (re-fetching is safe).
    class Fetcher
      MAX_RANGE_DAYS = 400
      RATE_SCALE = 15

      Result = Struct.new(:created, :updated, :unchanged, :skipped, :dates, keyword_init: true) do
        def as_json(*)
          { created: created, updated: updated, unchanged: unchanged, skipped: skipped, dates: dates }
        end
      end

      class RangeError < StandardError; end

      def initialize(organization:, provider: Providers::Ecb.new)
        @organization = organization
        @provider = provider
      end

      # Without a range, fetches the latest published day.
      def call(from: nil, to: nil)
        validate_range!(from, to)
        result = Result.new(created: 0, updated: 0, unchanged: 0, skipped: [], dates: [])
        sources = ecb_sources
        return result if sources.empty?

        rates_by_date = provider.rates(from: from, to: to, today: organization.today)
        result.dates = rates_by_date.keys.sort

        Accounting::ExchangeRate.transaction do
          sources.each do |source|
            store_source(source, rates_by_date, result)
          end
        end
        result
      end

      private

      attr_reader :organization, :provider

      def validate_range!(from, to)
        return if from.nil? && to.nil?
        raise RangeError, "from is required with to" if from.nil?

        to ||= organization.today
        raise RangeError, "from must not be after to" if from > to
        raise RangeError, "range is limited to #{MAX_RANGE_DAYS} days" if (to - from).to_i > MAX_RANGE_DAYS
      end

      def ecb_sources
        organization.exchange_rate_sources.active
                    .where(provider: Providers::Ecb::KEY)
                    .includes(:currency, :quote_currency)
                    .to_a
      end

      def main_currency
        @main_currency ||= organization.accounting_setting&.main_currency
      end

      def store_source(source, rates_by_date, result)
        currency_code = source.currency.abr.to_s.upcase
        quote = source.quote_currency || main_currency
        quote_code = quote&.abr.to_s.upcase

        stored_any = false
        rates_by_date.each do |date, rates|
          base = rates[currency_code]
          quoted = rates[quote_code]
          next unless base && quoted

          stored_any = true
          rate = (quoted / base).round(RATE_SCALE)
          upsert(source, date, rate, currency_code, quote_code, rates, result)
        end

        return if stored_any || rates_by_date.empty?

        missing = [ currency_code, quote_code ].reject { |code| rates_by_date.values.any? { |r| r.key?(code) } }
        result.skipped << {
          currency_id: source.currency_id,
          currency: currency_code,
          reason: "not_published",
          codes: missing
        }
      end

      def upsert(source, date, rate, currency_code, quote_code, rates, result)
        record = organization.exchange_rates.find_or_initialize_by(
          currency_id: source.currency_id, date: date, source: Providers::Ecb::KEY
        )
        record.quote_currency = source.quote_currency
        record.meta = {
          "pair" => "#{currency_code}/#{quote_code}",
          "eur_rates" => { currency_code => rates[currency_code].to_s("F"), quote_code => rates[quote_code].to_s("F") }
        }

        if record.new_record?
          record.rate = rate
          record.save!
          result.created += 1
        elsif record.rate != rate || record.quote_currency_id_changed?
          record.update!(rate: rate)
          result.updated += 1
        else
          record.save! if record.changed?
          result.unchanged += 1
        end
      end
    end
  end
end
