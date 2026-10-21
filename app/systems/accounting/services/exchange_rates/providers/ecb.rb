# app/systems/accounting/services/exchange_rates/providers/ecb.rb
require "net/http"

module Accounting
  module ExchangeRates
    module Providers
      # Euro foreign exchange reference rates of the European Central Bank.
      # Free, no API key. One set of rates per TARGET working day, published
      # around 16:00 CET, all quoted as "1 EUR = x currency".
      #
      # https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/
      class Ecb
        KEY = "ecb".freeze
        BASE_CURRENCY = "EUR".freeze
        BASE_URL = "https://www.ecb.europa.eu/stats/eurofxref".freeze
        FEEDS = {
          daily: "#{BASE_URL}/eurofxref-daily.xml",
          last_90_days: "#{BASE_URL}/eurofxref-hist-90d.xml",
          history: "#{BASE_URL}/eurofxref-hist.xml"
        }.freeze
        NAMESPACE = { "ecb" => "http://www.ecb.int/vocabulary/2002-08-01/eurofxref" }.freeze
        TIMEOUT = 20

        class Error < StandardError; end

        # Rates per date: { Date => { "USD" => BigDecimal("1.1253"), ... } }.
        # EUR itself is included with rate 1. Without a range only the
        # latest published day is returned.
        def rates(from: nil, to: nil, today: Date.current)
          feed = feed_for(from, today)
          parsed = parse(download(FEEDS.fetch(feed)))
          parsed.select! { |date, _| (from.nil? || date >= from) && (to.nil? || date <= to) } if from || to
          parsed
        end

        private

        def feed_for(from, today)
          return :daily if from.nil?

          from >= today - 85 ? :last_90_days : :history
        end

        def download(url)
          uri = URI(url)
          response = Net::HTTP.start(uri.host, uri.port, use_ssl: true,
                                     open_timeout: TIMEOUT, read_timeout: TIMEOUT) do |http|
            http.get(uri.request_uri, "Accept" => "application/xml")
          end
          raise Error, "ECB responded with HTTP #{response.code}" unless response.is_a?(Net::HTTPSuccess)

          response.body
        rescue Timeout::Error, SocketError, SystemCallError, OpenSSL::SSL::SSLError, Net::ProtocolError => e
          raise Error, "ECB request failed: #{e.class}: #{e.message}"
        end

        def parse(xml)
          document = Nokogiri::XML(xml) { |config| config.strict.nonet }
          document.xpath("//ecb:Cube[@time]", NAMESPACE).each_with_object({}) do |day, result|
            rates = { BASE_CURRENCY => BigDecimal("1") }
            day.xpath("ecb:Cube[@currency][@rate]", NAMESPACE).each do |cube|
              rates[cube["currency"].upcase] = BigDecimal(cube["rate"])
            end
            result[Date.iso8601(day["time"])] = rates
          end
        rescue Nokogiri::XML::SyntaxError, ArgumentError, Date::Error => e
          raise Error, "Unexpected ECB response: #{e.message}"
        end
      end
    end
  end
end
