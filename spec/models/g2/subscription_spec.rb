require "rails_helper"

RSpec.describe G2::Subscription, type: :model do
  let(:organization) { create(:organization, is_tenant: true, is_trial: true) }

  before do
    G2::Price.replace!("accounting", "level_1", "monthly", 2500)
    G2::Price.replace!("accounting", "level_2", "monthly", 7500)
    G2::Price.replace!("general", "level_1", "monthly", 0)
  end

  describe ".subscribe!" do
    context "when the organization is still in its trial" do
      it "starts the subscription at the trial end date, not today" do
        sub = described_class.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
        expect(sub.starts_at.to_date).to eq(organization.trial_end_date.to_date)
      end

      it "creates the subscription as pending, not active" do
        sub = described_class.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
        expect(sub.status).to eq("pending")
        expect(sub.currently_active?).to eq(false)
      end

      it "ends the trial flag immediately, even though access starts later" do
        described_class.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
        expect(organization.reload.is_trial).to eq(false)
      end
    end

    context "when the organization already has another active subscription (billing anchor)" do
      it "syncs the new subscription's end date to the existing one" do
        sub1 = described_class.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
        sub1.update!(status: "active") # simulate payment confirming

        sub2 = described_class.subscribe!(organization: organization, module_key: "general", plan: "level_1", billing_period: "monthly")

        expect(sub2.ends_at).to eq(sub1.ends_at)
      end
    end

    it "prevents two active subscriptions to the same module" do
      sub1 = described_class.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      sub1.update!(status: "active")

      expect {
        described_class.subscribe!(organization: organization, module_key: "accounting", plan: "level_2", billing_period: "monthly")
      }.to raise_error(ActiveRecord::RecordNotUnique)
    end

    it "raises for an unknown module/plan combo" do
      expect {
        described_class.subscribe!(organization: organization, module_key: "accounting", plan: "level_9", billing_period: "monthly")
      }.to raise_error(ActiveRecord::RecordNotFound)
    end
  end

  describe "#renew!" do
    it "extends ends_at from the current end date when not yet lapsed" do
      sub = described_class.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      original_end = sub.ends_at

      sub.renew!(billing_period: "monthly")

      expect(sub.ends_at).to be_within(1.minute).of(original_end + 1.month)
    end

    it "extends from today (not compounding) when already lapsed" do
      sub = described_class.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      sub.update!(ends_at: 10.days.ago, status: "active")

      sub.renew!(billing_period: "monthly")

      expect(sub.ends_at).to be_within(1.minute).of(Time.current + 1.month)
    end
  end

  describe "#activate!" do
    it "flips status from pending to active" do
      sub = described_class.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      sub.activate!
      expect(sub.reload.status).to eq("active")
    end
  end

  describe "#cancel!" do
    it "marks cancelled without immediately revoking access" do
      sub = described_class.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      sub.activate!

      sub.cancel!

      expect(sub.status).to eq("cancelled")
      expect(sub.cancelled_at).to be_present
      expect(sub.auto_renew).to eq(false)
      expect(sub.currently_active?).to eq(true) # still has access - ends_at hasn't passed yet
    end

    it "no longer counts as active once ends_at has passed" do
      sub = described_class.subscribe!(organization: organization, module_key: "accounting", plan: "level_1", billing_period: "monthly")
      sub.activate!
      sub.cancel!
      sub.update!(ends_at: 1.day.ago)

      expect(sub.currently_active?).to eq(false)
    end
  end
end