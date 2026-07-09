require "swagger_helper"

RSpec.describe "G2 Subscriptions", type: :request do
  let(:user) { create(:user) }
  let(:organization) { create(:organization, is_tenant: true, is_trial: true) }
  let(:organization_id) { organization.id }

  before do
    sign_in user
    G2::Price.replace!("accounting", "level_1", "monthly", 2500)
  end

  path "/organizations/{organization_id}/g2/subscriptions" do
    post "Subscribe an organization to a module" do
      tags "Subscriptions"
      consumes "application/json"
      produces "application/json"

      parameter name: :organization_id, in: :path, type: :integer, required: true
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          module_key: { type: :string, example: "accounting", description: "One of G2::Modules::ALL" },
          plan: { type: :string, example: "level_1", description: "One of G2::Plans::ALL" },
          billing_period: { type: :string, enum: %w[monthly annual] }
        },
        required: %w[module_key plan billing_period]
      }

      response "201", "subscription created (pending until paid)" do
        schema type: :object,
               properties: {
                 subscription: {
                   type: :object,
                   properties: {
                     id: { type: :integer },
                     module: { type: :string },
                     plan: { type: :string },
                     status: { type: :string, example: "pending" },
                     starts_at: { type: :string, format: "date-time" },
                     ends_at: { type: :string, format: "date-time" }
                   }
                 },
                 invoice: {
                   type: :object,
                   properties: {
                     id: { type: :integer },
                     invoice_number: { type: :string },
                     total: { type: :number, example: 25.0 },
                     status: { type: :string, example: "pending" },
                     due_at: { type: :string, format: "date-time" }
                   }
                 }
               }

        let(:body) { { module_key: "accounting", plan: "level_1", billing_period: "monthly" } }
        run_test!
      end

      response "422", "invalid module/plan, or an active subscription to this module already exists" do
        schema type: :object, properties: { error: { type: :string } }

        let(:body) { { module_key: "nonsense", plan: "level_1", billing_period: "monthly" } }
        run_test!
      end
    end
  end

  path "/organizations/{organization_id}/g2/subscriptions/{id}/renew" do
    post "Charge for the next billing period" do
      tags "Subscriptions"
      produces "application/json"
      description "Creates a renewal invoice (including any overage from the period ending). " \
                   "The subscription's end date only extends once this invoice is paid."

      parameter name: :organization_id, in: :path, type: :integer, required: true
      parameter name: :id, in: :path, type: :integer, required: true, description: "Subscription id"

      response "201", "renewal invoice created" do
        schema type: :object,
               properties: {
                 invoice: {
                   type: :object,
                   properties: {
                     id: { type: :integer },
                     invoice_number: { type: :string },
                     total: { type: :number },
                     status: { type: :string },
                     due_at: { type: :string, format: "date-time" }
                   }
                 }
               }

        let(:id) do
          sub = G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
          G2::Invoice.create_for_subscription!(sub).mark_paid!
          sub.id
        end
        run_test!
      end

      response "404", "subscription not found" do
        let(:id) { 0 }
        run_test!
      end
    end
  end

  path "/organizations/{organization_id}/g2/subscriptions/{id}/cancel" do
    post "Cancel a subscription" do
      tags "Subscriptions"
      produces "application/json"
      description "Stops auto-renewal immediately. Access continues until the subscription's ends_at - already-paid-for time is never revoked early."

      parameter name: :organization_id, in: :path, type: :integer, required: true
      parameter name: :id, in: :path, type: :integer, required: true, description: "Subscription id"

      response "200", "subscription cancelled" do
        schema type: :object,
               properties: {
                 id: { type: :integer },
                 module: { type: :string },
                 plan: { type: :string },
                 status: { type: :string, example: "cancelled" },
                 starts_at: { type: :string, format: "date-time" },
                 ends_at: { type: :string, format: "date-time" }
               }

        let(:id) do
          sub = G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
          G2::Invoice.create_for_subscription!(sub).mark_paid!
          sub.id
        end
        run_test!
      end

      response "404", "subscription not found" do
        let(:id) { 0 }
        run_test!
      end
    end
  end
end