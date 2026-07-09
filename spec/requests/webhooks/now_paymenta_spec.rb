require "rails_helper"

RSpec.describe "Webhooks::NowPayments", type: :request do
  let(:organization) { create(:organization, is_tenant: true, is_trial: false) }
  let(:subscription) do
    G2::Price.replace!("accounting", "level_1", "monthly", 2500)
    G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
  end
  let(:invoice) { G2::Invoice.create_for_subscription!(subscription) }
  let(:payment) { invoice.payments.create!(provider: "nowpayments", provider_payment_id: "np_123", amount_cents: invoice.total_cents) }
  let(:ipn_secret) { "test_ipn_secret" }

  before do
    allow(Rails.application.config.x.now_payments).to receive(:ipn_secret).and_return(ipn_secret)
  end

  def signed_headers_for(payload)
    sorted = NowPayments::Client.sort_keys(payload).to_json
    signature = OpenSSL::HMAC.hexdigest("SHA512", ipn_secret, sorted)
    { "x-nowpayments-sig" => signature, "Content-Type" => "application/json" }
  end

  describe "POST /webhooks/now_payments" do
    it "confirms the payment and cascades to activate the subscription" do
      payload = { "payment_id" => "np_123", "order_id" => payment.id.to_s, "payment_status" => "confirmed" }

      post "/webhooks/now_payments", params: payload.to_json, headers: signed_headers_for(payload)

      expect(response).to have_http_status(:ok)
      expect(invoice.reload.paid?).to eq(true)
      expect(subscription.reload.active?).to eq(true)
    end

    it "rejects a request with an invalid signature" do
      payload = { "payment_id" => "np_123", "order_id" => payment.id.to_s, "payment_status" => "confirmed" }

      post "/webhooks/now_payments", params: payload.to_json,
           headers: { "x-nowpayments-sig" => "wrong", "Content-Type" => "application/json" }

      expect(response).to have_http_status(:unauthorized)
      expect(invoice.reload.paid?).to eq(false)
    end

    it "returns 200 for an unknown payment_id (no matching row) rather than erroring" do
      payload = { "payment_id" => "does_not_exist", "order_id" => "999999", "payment_status" => "confirmed" }

      post "/webhooks/now_payments", params: payload.to_json, headers: signed_headers_for(payload)

      expect(response).to have_http_status(:ok)
    end
  end
end