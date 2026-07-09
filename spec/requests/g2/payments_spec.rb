require "rails_helper"

RSpec.describe "G2::Payments", type: :request do
  let(:user) { create(:user) }
  let(:organization) { create(:organization, is_tenant: true, is_trial: false) }
  let(:subscription) do
    G2::Price.replace!("accounting", "level_1", "monthly", 2500)
    G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
  end
  let(:invoice) { G2::Invoice.create_for_subscription!(subscription) }

  before { sign_in user }

  describe "POST /organizations/:organization_id/g2/invoices/:invoice_id/payments" do
    it "creates a payment and returns the checkout URL, without calling the real API" do
      fake_response = { "id" => "np_123", "invoice_url" => "https://nowpayments.io/payment/np_123" }
      allow_any_instance_of(NowPayments::Client).to receive(:create_invoice).and_return(fake_response)

      post "/organizations/#{organization.id}/g2/invoices/#{invoice.id}/payments"

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body["invoice_url"]).to eq("https://nowpayments.io/payment/np_123")

      payment = invoice.payments.last
      expect(payment.provider_payment_id).to eq("np_123")
    end

    it "returns 502 when NOWPayments errors out" do
      allow_any_instance_of(NowPayments::Client).to receive(:create_invoice)
        .and_raise(NowPayments::Client::Error, "simulated failure")

      post "/organizations/#{organization.id}/g2/invoices/#{invoice.id}/payments"

      expect(response).to have_http_status(:bad_gateway)
    end
  end
end