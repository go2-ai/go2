# frozen_string_literal: true

require "rails_helper"

RSpec.describe G2::BillingMailer, type: :mailer do
  let(:org) { create(:organization, is_tenant: true, name: "TestOrg") }
  let(:admin) { create(:user, email: "admin@test.com") }

  before do
    G2::Price.replace!("accounting", "level_1", "monthly", 2500)
  end

  describe "#trial_ending_soon" do
    let(:mail) { described_class.trial_ending_soon(org, admin, days_left: 3) }

    it "renders headers" do
      expect(mail.subject).to eq("Your trial ends in 3 days")
      expect(mail.to).to eq(["admin@test.com"])
    end

    it "includes the organization name in the body" do
      expect(mail.body.encoded).to include("TestOrg")
    end
  end

  describe "#subscription_ending_soon" do
    let(:sub) do
      G2::Subscription.subscribe!(organization: org, module_key: "accounting", plan: "level_1", billing_period: "monthly")
    end
    let(:mail) { described_class.subscription_ending_soon(org, admin, sub, 3) }

    it "renders headers" do
      expect(mail.subject).to include("ends in 3 days")
    end
  end

  describe "#grace_period_ending" do
    let(:sub) do
      G2::Subscription.subscribe!(organization: org, module_key: "accounting", plan: "level_1", billing_period: "monthly")
    end
    let(:mail) { described_class.grace_period_ending(org, admin, sub) }

    it "renders headers" do
      expect(mail.subject).to include("grace period")
    end
  end

  describe "#renewal_invoice_created" do
    let(:sub) do
      G2::Subscription.subscribe!(organization: org, module_key: "accounting", plan: "level_1", billing_period: "monthly")
    end
    let(:invoice) { G2::Invoice.create_for_subscription!(sub) }
    let(:mail) { described_class.renewal_invoice_created(org, admin, invoice) }

    it "includes the invoice number" do
      expect(mail.body.encoded).to include(invoice.invoice_number)
    end
  end

  describe "#auto_renewal_failed" do
    let(:sub) do
      G2::Subscription.subscribe!(organization: org, module_key: "accounting", plan: "level_1", billing_period: "monthly")
    end
    let(:mail) { described_class.auto_renewal_failed(org, admin, sub) }

    it "renders headers" do
      expect(mail.subject).to include("Auto-renewal failed")
    end
  end

  describe "#subscription_expired" do
    let(:sub) do
      G2::Subscription.subscribe!(organization: org, module_key: "accounting", plan: "level_1", billing_period: "monthly")
    end
    let(:mail) { described_class.subscription_expired(org, admin, sub) }

    it "renders headers" do
      expect(mail.subject).to include("expired")
    end
  end
end