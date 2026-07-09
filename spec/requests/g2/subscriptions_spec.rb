require "rails_helper"

RSpec.describe "G2::Subscriptions", type: :request do
  # ASSUMPTION: adjust `user` / sign_in to match your real auth setup if
  # this differs (e.g. if current_organization is set some other way).
  let(:user) { create(:user) }
  let(:organization) { create(:organization, is_tenant: true, is_trial: true) }

  before do
    sign_in user
    G2::Price.replace!("accounting", "level_1", "monthly", 2500)
  end

  describe "POST /organizations/:organization_id/g2/subscriptions" do
    it "creates a pending subscription and its invoice" do
      post "/organizations/#{organization.id}/g2/subscriptions",
           params: { module_key: "accounting", plan: "level_1", billing_period: "monthly" },
           as: :json

      expect(response).to have_http_status(:created)

      body = JSON.parse(response.body)
      expect(body["subscription"]["status"]).to eq("pending")
      expect(body["invoice"]["total"]).to eq(25.0)
    end

    it "returns 422 for an invalid module" do
      post "/organizations/#{organization.id}/g2/subscriptions",
           params: { module_key: "nonsense", plan: "level_1", billing_period: "monthly" },
           as: :json

      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "POST /organizations/:organization_id/g2/subscriptions/:id/renew" do
    let(:paid_subscription) do
      sub = G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      G2::Invoice.create_for_subscription!(sub).mark_paid!
      sub
    end

    it "creates a renewal invoice without extending the subscription yet" do
      original_ends_at = paid_subscription.ends_at

      post "/organizations/#{organization.id}/g2/subscriptions/#{paid_subscription.id}/renew"

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body["invoice"]["total"]).to eq(25.0)
      expect(paid_subscription.reload.ends_at).to eq(original_ends_at)
    end
  end

  describe "POST /organizations/:organization_id/g2/subscriptions/:id/cancel" do
    let(:paid_subscription) do
      sub = G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      G2::Invoice.create_for_subscription!(sub).mark_paid!
      sub
    end

    it "cancels without immediately revoking access" do
      post "/organizations/#{organization.id}/g2/subscriptions/#{paid_subscription.id}/cancel"

      expect(response).to have_http_status(:ok)
      expect(paid_subscription.reload.status).to eq("cancelled")
      expect(paid_subscription.currently_active?).to eq(true)
    end
  end
end