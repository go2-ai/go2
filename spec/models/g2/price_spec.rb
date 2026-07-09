require "rails_helper"

RSpec.describe G2::Price, type: :model do
  describe "validations" do
    it "rejects an invalid module" do
      price = described_class.new(module: "nonsense", plan: "level_1", billing_period: "monthly", amount_cents: 100)
      expect(price).not_to be_valid
    end

    it "rejects an invalid plan" do
      price = described_class.new(module: "accounting", plan: "nonsense", billing_period: "monthly", amount_cents: 100)
      expect(price).not_to be_valid
    end

    it "rejects an invalid billing_period" do
      price = described_class.new(module: "accounting", plan: "level_1", billing_period: "weekly", amount_cents: 100)
      expect(price).not_to be_valid
    end

    it "rejects a negative amount_cents" do
      price = described_class.new(module: "accounting", plan: "level_1", billing_period: "monthly", amount_cents: -1)
      expect(price).not_to be_valid
    end
  end

  describe ".replace!" do
    it "creates the first price as active" do
      described_class.replace!("accounting", "level_1", "monthly", 2500)
      expect(described_class.current("accounting", "level_1", "monthly").amount_cents).to eq(2500)
    end

    it "deactivates the old price when replaced" do
      described_class.replace!("accounting", "level_1", "monthly", 2500)
      old = described_class.find_by(module: "accounting", plan: "level_1", billing_period: "monthly", active: true)

      described_class.replace!("accounting", "level_1", "monthly", 3000)

      expect(old.reload.active).to eq(false)
      expect(described_class.current("accounting", "level_1", "monthly").amount_cents).to eq(3000)
    end

    it "never leaves more than one active price for the same combo" do
      described_class.replace!("accounting", "level_1", "monthly", 2500)
      described_class.replace!("accounting", "level_1", "monthly", 3000)

      active_count = described_class.where(
        module: "accounting", plan: "level_1", billing_period: "monthly", active: true
      ).count

      expect(active_count).to eq(1)
    end
  end

  describe "#amount" do
    it "converts cents to dollars" do
      price = described_class.new(amount_cents: 2500)
      expect(price.amount).to eq(25.0)
    end
  end
end