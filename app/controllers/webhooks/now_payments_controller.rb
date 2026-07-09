module Webhooks
  class NowPaymentsController < ActionController::Base
    # This is hit by NOWPayments' servers, not a browser - skip CSRF
    # protection and any session/auth concerns entirely.
    skip_before_action :verify_authenticity_token, raise: false

    # POST /webhooks/now_payments
    def create
      raw_body = request.raw_post
      payload = NowPayments::Client.verify_ipn!(raw_body, request.headers["x-nowpayments-sig"])

      payment = G2::Payment.find_by(provider_payment_id: payload["payment_id"].to_s)
      payment ||= G2::Payment.find_by(id: payload["order_id"]) # fallback if IPN arrives before we save provider_payment_id

      if payment
        payment.update_from_ipn!(payload)
        head :ok
      else
        Rails.logger.warn("[NOWPayments IPN] Unknown payment_id=#{payload['payment_id']} order_id=#{payload['order_id']}")
        head :ok # still 200 - NOWPayments retries on non-2xx, we just have nothing to do
      end
    rescue NowPayments::Client::Error => e
      Rails.logger.error("[NOWPayments IPN] Signature check failed: #{e.message}")
      head :unauthorized
    rescue JSON::ParserError
      head :bad_request
    end
  end
end