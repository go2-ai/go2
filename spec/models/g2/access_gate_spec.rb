require "rails_helper"

RSpec.describe G2::AccessGate, type: :model do
  let(:organization) { create(:organization, is_tenant: true, is_trial: true) }
  let(:gate) { described_class.new(organization) }

  before { G2::Price.replace!("accounting", "level_1", "monthly", 2500) }

  describe "during the trial" do
    it "grants system access" do
      expect(gate.system_locked?).to eq(false)
    end

    it "grants access to every module, even ones never subscribed to" do
      expect(gate.module_accessible?("accounting")).to eq(true)
      expect(gate.module_accessible?("payroll")).to eq(true)
    end
  end

  describe "after the trial ends, with nothing ever purchased" do
    let(:organization) { create(:organization, is_tenant: true, is_trial: false, created_at: 20.days.ago) }

    it "locks the whole system" do
      expect(gate.system_locked?).to eq(true)
    end

    it "locks every individual module too" do
      expect(gate.module_accessible?("accounting")).to eq(false)
    end

    it "reports module_status as :none" do
      expect(gate.module_status("accounting")).to eq(:none)
    end
  end

  describe "with a pending (unpaid) subscription" do
    before do
      G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      organization.update!(is_trial: false)
    end

    it "does not grant access - pending means never activated" do
      expect(gate.module_accessible?("accounting")).to eq(false)
      expect(gate.module_status("accounting")).to eq(:none)
    end
  end

  describe "with an active, current subscription" do
    let(:subscription) do
      sub = G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      G2::Invoice.create_for_subscription!(sub).mark_paid!
      sub
    end

    before { subscription }

    it "grants access to that module" do
      expect(gate.module_accessible?("accounting")).to eq(true)
      expect(gate.module_status("accounting")).to eq(:active)
    end

    it "does not grant access to a DIFFERENT, unsubscribed module" do
      expect(gate.module_accessible?("payroll")).to eq(false)
    end

    it "keeps the system unlocked" do
      expect(gate.system_locked?).to eq(false)
    end
  end

  describe "with a lapsed subscription, still within the grace period" do
    let(:subscription) do
      sub = G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      G2::Invoice.create_for_subscription!(sub).mark_paid!
      sub.update!(ends_at: 5.days.ago) # lapsed 5 days ago, grace is 15 days
      sub
    end

    before { subscription }

    it "still grants access (grace period)" do
      expect(gate.module_accessible?("accounting")).to eq(true)
      expect(gate.module_status("accounting")).to eq(:grace)
    end
  end

  describe "with a lapsed subscription, past the grace period" do
    let(:subscription) do
      sub = G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      G2::Invoice.create_for_subscription!(sub).mark_paid!
      sub.update!(ends_at: 20.days.ago) # lapsed 20 days ago, grace is only 15
      sub
    end

    before { subscription }

    it "locks that module" do
      expect(gate.module_accessible?("accounting")).to eq(false)
      expect(gate.module_status("accounting")).to eq(:locked)
    end

    it "locks the whole system if this was the org's only module" do
      expect(gate.system_locked?).to eq(true)
    end
  end

  describe "with a cancelled but not-yet-lapsed subscription" do
    let(:subscription) do
      sub = G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      G2::Invoice.create_for_subscription!(sub).mark_paid!
      sub.cancel!
      sub
    end

    before { subscription }

    it "still grants access - cancel! doesn't revoke early" do
      expect(gate.module_accessible?("accounting")).to eq(true)
    end
  end

  describe "system_locked? with multiple modules" do
    it "stays unlocked if ANY module is still accessible" do
      sub1 = G2::Subscription.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      G2::Invoice.create_for_subscription!(sub1).mark_paid!
      sub1.update!(ends_at: 20.days.ago) # this one's dead

      G2::Price.replace!("general", "level_1", "monthly", 0)
      sub2 = G2::Subscription.subscribe!(organization: organization, module_key: "general", plan: "level_1", billing_period: "monthly")
      G2::Invoice.create_for_subscription!(sub2).mark_paid! # this one's alive

      expect(gate.module_accessible?("accounting")).to eq(false)
      expect(gate.module_accessible?("general")).to eq(true)
      expect(gate.system_locked?).to eq(false)
    end
  end
end