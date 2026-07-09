require "net/http"
require "json"
require "openssl"

module NowPayments
  class Client
    Error = Class.new(StandardError)

    def initialize
      @api_key = Rails.application.config.x.now_payments.api_key
      @base_url = Rails.application.config.x.now_payments.base_url
    end

    # Creates a hosted invoice - NOWPayments shows the customer a checkout page
    # where they pick their crypto and see the address/QR. Simplest possible flow.
    def create_invoice(price_amount:, order_id:, order_description: nil,
                        price_currency: "usd", success_url: nil, cancel_url: nil)
      post("/v1/invoice", {
        price_amount: price_amount,
        price_currency: price_currency,
        order_id: order_id,
        order_description: order_description,
        ipn_callback_url: Rails.application.config.x.now_payments.ipn_callback_url,
        success_url: success_url,
        cancel_url: cancel_url
      }.compact)
    end

    # Lightweight connectivity check - hits NOWPayments' public status
    # endpoint. Useful as a first smoke test since it doesn't require the
    # invoice/payment logic to be correct, just that the API is reachable.
    def status
      get("/v1/status")
    end

    def payment_status(payment_id)
      get("/v1/payment/#{payment_id}")
    end

    # Verifies the x-nowpayments-sig header against the raw request body.
    # NOWPayments signs a sorted-key JSON version of the payload with HMAC-SHA512.
    def self.verify_ipn!(raw_body, signature_header)
      secret = Rails.application.config.x.now_payments.ipn_secret
      parsed = JSON.parse(raw_body)
      sorted_json = sort_keys(parsed).to_json
      expected = OpenSSL::HMAC.hexdigest("SHA512", secret, sorted_json)

      unless ActiveSupport::SecurityUtils.secure_compare(expected, signature_header.to_s)
        raise Error, "Invalid IPN signature"
      end

      parsed
    end

    def self.sort_keys(obj)
      case obj
      when Hash
        obj.keys.sort.each_with_object({}) { |k, h| h[k] = sort_keys(obj[k]) }
      when Array
        obj.map { |v| sort_keys(v) }
      else
        obj
      end
    end

    private

    def post(path, body)
      request(Net::HTTP::Post, path, body)
    end

    def get(path)
      request(Net::HTTP::Get, path, nil)
    end

    def request(http_method, path, body)
      uri = URI("#{@base_url}#{path}")
      req = http_method.new(uri)
      req["x-api-key"] = @api_key
      req["Content-Type"] = "application/json"
      req.body = body.to_json if body

      res = Net::HTTP.start(uri.host, uri.port, use_ssl: true) { |http| http.request(req) }
      parsed = JSON.parse(res.body)
      raise Error, parsed["message"] || "NOWPayments error (#{res.code})" unless res.is_a?(Net::HTTPSuccess)

      parsed
    end
  end
end
