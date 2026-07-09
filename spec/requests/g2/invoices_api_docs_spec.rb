require "swagger_helper"

RSpec.describe "G2 Invoices", type: :request do
  let(:user) { create(:user) }
  let(:organization) { create(:organization, is_tenant: true, is_trial: false) }
  let(:organization_id) { organization.id }

  before do
    sign_in user
    G2::Price.replace!("accounting", "level_1", "monthly", 2500)
  end

  path "/organizations/{organization_id}/g2/invoices/{id}" do
    get "Fetch an invoice, its line items, and its payment attempts" do
      tags "Invoices"
      produces "application/json"

      parameter name: :organization_id, in: :path, type: :integer, required: true
      parameter name: :id, in: :path, type: :integer, required: true

      response "200", "invoice found" do
        schema type: :object,
               properties: {
                 id: { type: :integer },
                 invoice_number: { type: :string },
                 total: { type: :number },
                 status: { type: :string, example: "pending" },
                 due_at: { type: :string, format: "date-time" },
                 paid_at: { type: :string, format: "date-time", nullable: true },
                 items: {
                   type: :array,
                   items: {
                     type: :object,
                     properties: {
                       module: { type: :string },
                       plan: { type: :string },
                       quantity: { type: :integer },
                       unit_price: { type: :number },
                       amount: { type: :number },
                       period_start: { type: :string, format: "date-time" },
                       period_end: { type: :string, format: "date-time" }
                     }
                   }
                 },
                 payments: {
                   type: :array,
                   items: {
                     type: :object,
                     properties: {
                       id: { type: :integer },
                       provider: { type: :string, example: "nowpayments" },
                       status: { type: :string, example: "waiting" },
                       invoice_url: { type: :string, nullable: true, description: "NOWPayments hosted checkout link" }
                     }
                   }
                 }
               }

        let(:id) do
          sub = G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
          G2::Invoice.create_for_subscription!(sub).id
        end
        run_test!
      end

      response "404", "invoice not found" do
        let(:id) { 0 }
        run_test!
      end
    end
  end
end