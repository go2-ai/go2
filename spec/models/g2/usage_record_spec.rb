require "rails_helper"

RSpec.describe G2::UsageRecord, type: :model do
  let(:organization) { create(:organization, is_tenant: true) }

  describe ".record!" do
    it "creates a new row on first use" do
      described_class.record!(organization: organization, module_key: "accounting", key: "journal_entries", on: Date.new(2026, 7, 1))

      row = described_class.find_by(organization: organization, module: "accounting", key: "journal_entries", period: Date.new(2026, 7, 1))
      expect(row.quantity).to eq(1)
    end

    it "atomically increments an existing row for the same org+module+key+day" do
      3.times { described_class.record!(organization: organization, module_key: "accounting", key: "journal_entries", on: Date.new(2026, 7, 1)) }

      row = described_class.find_by(organization: organization, module: "accounting", key: "journal_entries", period: Date.new(2026, 7, 1))
      expect(row.quantity).to eq(3)
    end

    it "keeps separate rows for separate days" do
      described_class.record!(organization: organization, module_key: "accounting", key: "journal_entries", on: Date.new(2026, 7, 1))
      described_class.record!(organization: organization, module_key: "accounting", key: "journal_entries", on: Date.new(2026, 7, 2))

      expect(described_class.where(organization: organization).count).to eq(2)
    end

    it "supports recording more than 1 at a time" do
      described_class.record!(organization: organization, module_key: "general", key: "storage_gb", quantity: 5, on: Date.new(2026, 7, 1))
      row = described_class.find_by(organization: organization, module: "general", key: "storage_gb")
      expect(row.quantity).to eq(5)
    end
  end

  describe ".total_for" do
    it "sums usage within a date range" do
      described_class.record!(organization: organization, module_key: "accounting", key: "journal_entries", quantity: 10, on: Date.new(2026, 7, 1))
      described_class.record!(organization: organization, module_key: "accounting", key: "journal_entries", quantity: 20, on: Date.new(2026, 7, 15))
      described_class.record!(organization: organization, module_key: "accounting", key: "journal_entries", quantity: 99, on: Date.new(2026, 8, 1)) # outside range

      total = described_class.total_for(organization, module_key: "accounting", key: "journal_entries", from: Date.new(2026, 7, 1), to: Date.new(2026, 7, 31))
      expect(total).to eq(30)
    end

    it "rolls up usage across descendant organizations" do
      child = create(:organization, is_tenant: false, parent_id: organization.id)
      grandchild = create(:organization, is_tenant: false, parent_id: child.id)

      described_class.record!(organization: organization, module_key: "accounting", key: "journal_entries", quantity: 5, on: Date.new(2026, 7, 1))
      described_class.record!(organization: child, module_key: "accounting", key: "journal_entries", quantity: 7, on: Date.new(2026, 7, 1))
      described_class.record!(organization: grandchild, module_key: "accounting", key: "journal_entries", quantity: 3, on: Date.new(2026, 7, 1))

      total = described_class.total_for(organization, module_key: "accounting", key: "journal_entries", from: Date.new(2026, 7, 1), to: Date.new(2026, 7, 31))
      expect(total).to eq(15)
    end

    it "does not include usage from unrelated organizations" do
      other_org = create(:organization, is_tenant: true)
      described_class.record!(organization: other_org, module_key: "accounting", key: "journal_entries", quantity: 999, on: Date.new(2026, 7, 1))

      total = described_class.total_for(organization, module_key: "accounting", key: "journal_entries", from: Date.new(2026, 7, 1), to: Date.new(2026, 7, 31))
      expect(total).to eq(0)
    end
  end
end