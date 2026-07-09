require "swagger_helper"

RSpec.describe "G2 Payments", type: :request do
  let(:user) { create(:user) }
  let(:organization) { create(:organization, is_tenant: true, is_trial: false) }
  let(:organization_id) { organization.id }
  let(:invoice_id) do
    sub = G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
    G2::Invoice.create_for_subscription!(sub).id
  end

  before do
    sign_in user
    G2::Price.replace!("accounting", "level_1", "monthly", 2500)
  end

  path "/organizations/{organization_id}/g2/invoices/{invoice_id}/payments" do
    post "Start (or retry) a crypto payment attempt for an invoice" do
      tags "Payments"
      produces "application/json"
      description "Creates a payment attempt via NOWPayments and returns a hosted checkout URL. " \
                   "Safe to call again if a previous attempt expired or failed - each call creates " \
                   "a new payment row against the same invoice, no duplicate billing."

      parameter name: :organization_id, in: :path, type: :integer, required: true
      parameter name: :invoice_id, in: :path, type: :integer, required: true

      response "201", "checkout URL created" do
        schema type: :object,
               properties: {
                 id: { type: :integer },
                 status: { type: :string, example: "waiting" },
                 invoice_url: { type: :string, description: "Redirect the customer here to complete payment" }
               }

        before do
          fake_response = { "id" => "np_docs_example", "invoice_url" => "https://nowpayments.io/payment/np_docs_example" }
          allow_any_instance_of(NowPayments::Client).to receive(:create_invoice).and_return(fake_response)
        end

        run_test!
      end

      response "502", "NOWPayments API error" do
        schema type: :object, properties: { error: { type: :string } }

        before do
          allow_any_instance_of(NowPayments::Client).to receive(:create_invoice)
            .and_raise(NowPayments::Client::Error, "simulated failure")
        end

        run_test!
      end
    end
  end
end