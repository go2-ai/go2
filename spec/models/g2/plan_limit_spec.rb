require "rails_helper"

RSpec.describe G2::PlanLimit, type: :model do
  describe "validations" do
    it "rejects an invalid module" do
      limit = described_class.new(module: "nonsense", plan: "level_1", key: "journal_entries", value: 50)
      expect(limit).not_to be_valid
    end

    it "allows a nil value (unlimited)" do
      limit = described_class.new(module: "accounting", plan: "level_3", key: "journal_entries", value: nil)
      expect(limit).to be_valid
    end

    it "rejects a negative value" do
      limit = described_class.new(module: "accounting", plan: "level_1", key: "journal_entries", value: -5)
      expect(limit).not_to be_valid
    end

    it "enforces one row per module+plan+key combo" do
      described_class.create!(module: "accounting", plan: "level_1", key: "journal_entries", value: 50, overage_price_cents: 20)

      duplicate = described_class.new(module: "accounting", plan: "level_1", key: "journal_entries", value: 100)
      expect { duplicate.save!(validate: false) }.to raise_error(ActiveRecord::RecordNotUnique)
    end
  end

  describe "#unlimited?" do
    it "is true when value is nil" do
      expect(described_class.new(value: nil).unlimited?).to eq(true)
    end

    it "is false when value is set" do
      expect(described_class.new(value: 100).unlimited?).to eq(false)
    end
  end

  describe ".for" do
    it "finds the matching row" do
      described_class.create!(module: "general", plan: "level_2", key: "storage_gb", value: 25, overage_price_cents: 50)
      result = described_class.for("general", "level_2", "storage_gb")
      expect(result.value).to eq(25)
    end
  end
end