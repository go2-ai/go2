require 'rails_helper'
require 'securerandom'

RSpec.describe Accounting::Currency, type: :model do
  describe "database schema" do
    it { should have_db_column(:name).of_type(:jsonb) }
    it { should have_db_column(:abr).of_type(:string) }
    it { should have_db_column(:decimal_digits).of_type(:integer) }
    it { should have_db_column(:organization_id).of_type(:integer).with_options(null: false) }
    it { should have_db_column(:created_at).of_type(:datetime) }
    it { should have_db_column(:updated_at).of_type(:datetime) }

    it { should have_db_index(:name).using(:gin) }
    it { should have_db_index(:abr) }
    it { should have_db_index(:organization_id) }
  end

  let(:organization) { create(:organization, name: { en: "Currency Org #{SecureRandom.uuid}" }) }

  describe "associations" do
    it { should belong_to(:organization) }
  end

  describe "validations" do
    it { should validate_presence_of(:abr) }
    it { should validate_presence_of(:decimal_digits) }

    it "validates uniqueness of abr within organization scope" do
      create(:accounting_currency, organization:, abr: "EUR")

      duplicate = build(:accounting_currency, organization:, abr: "EUR")
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:abr]).to include("has already been taken")
    end

    it "allows the same abr in a different organization" do
      create(:accounting_currency, organization:, abr: "EUR")
      other_org = create(:organization, name: { en: "Other Currency Org #{SecureRandom.uuid}" })

      other_currency = build(:accounting_currency, organization: other_org, abr: "EUR")
      expect(other_currency).to be_valid
    end
  end

  describe "PaperTrail" do
    it { should be_versioned }

    it "tracks changes to currency attributes" do
      currency = create(:accounting_currency, organization:)

      PaperTrail.enabled = true

      expect {
        currency.update!(decimal_digits: 3)
      }.to change { currency.versions.count }.by(1)

      version = currency.versions.last
      expect(version).not_to be_nil
      expect(version.event).to eq("update")
      expect(version.item_type).to eq("Accounting::Currency")
      expect(version.item_id).to eq(currency.id)
    end
  end

  describe "translations" do
    it "supports name translations" do
      currency = create(:accounting_currency, organization:, name: { "en" => "US Dollar", "fa" => "دلار آمریکا" })

      Mobility.with_locale(:en) { expect(currency.name).to eq("US Dollar") }
      Mobility.with_locale(:fa) { expect(currency.name).to eq("دلار آمریکا") }
    end

    it "uses fallbacks if translation is missing" do
      currency = create(:accounting_currency, organization:, name: { "en" => "US Dollar" })

      Mobility.with_locale(:fa) { expect(currency.name).to eq("US Dollar") }
    end
  end
end
