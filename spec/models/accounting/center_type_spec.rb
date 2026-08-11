# spec/models/accounting/center_type_spec.rb
require 'rails_helper'
require 'securerandom'

RSpec.describe Accounting::CenterType, type: :model do
  describe "database schema" do
    it { should have_db_column(:name).of_type(:jsonb).with_options(null: false, default: {}) }
    it { should have_db_column(:first_code).of_type(:string).with_options(null: false) }
    it { should have_db_column(:last_code).of_type(:string).with_options(null: false) }
    it { should have_db_column(:auto_increment).of_type(:boolean).with_options(default: true, null: false) }
    it { should have_db_column(:metadata).of_type(:jsonb).with_options(null: false, default: []) }
    it { should have_db_column(:organization_id).of_type(:integer).with_options(null: false) }
    it { should have_db_column(:created_at).of_type(:datetime) }
    it { should have_db_column(:updated_at).of_type(:datetime) }

    it { should have_db_index(:name).using(:gin) }
    it { should have_db_index(:organization_id) }
  end

  let(:organization) { create(:organization, name: { en: "CenterType Org #{SecureRandom.uuid}" }) }

  describe "associations" do
    it { should belong_to(:organization) }
  end

  describe "validations" do
    it "is not valid with a name not containing at least one translation" do
      center_type = build(:accounting_center_type, name: {}, organization: organization)
      expect(center_type).not_to be_valid
      expect(center_type.errors[:name].join(", ")).to include("must contain at least one")
    end

    it "is valid with a name containing at least one translation" do
      center_type = build(:accounting_center_type, organization: organization, name: { en: "Cost Centers" })
      expect(center_type).to be_valid
    end

    it "validates uniqueness of name within organization scope" do
      create(:accounting_center_type, organization: organization, name: { en: "Revenue Centers" })

      duplicate = build(:accounting_center_type, organization: organization, name: { en: "Revenue Centers" })
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:name]).to include(/has already been taken/)
    end

    it "allows the same name in a different organization" do
      create(:accounting_center_type, organization: organization, name: { en: "Shared Name" })
      other_org = create(:organization, name: { en: "Other CenterType Org #{SecureRandom.uuid}" })

      other = build(:accounting_center_type, organization: other_org, name: { en: "Shared Name" })
      expect(other).to be_valid
    end

    it "validates presence of first_code" do
      center_type = build(:accounting_center_type, organization: organization, first_code: nil)
      expect(center_type).not_to be_valid
      expect(center_type.errors[:first_code]).to include("can't be blank")
    end

    it "validates presence of last_code" do
      center_type = build(:accounting_center_type, organization: organization, last_code: nil)
      expect(center_type).not_to be_valid
      expect(center_type.errors[:last_code]).to include("can't be blank")
    end

    it "validates first_code is not greater than last_code" do
      center_type = build(:accounting_center_type, organization: organization, first_code: "050", last_code: "010")
      expect(center_type).not_to be_valid
      expect(center_type.errors[:first_code]).to include("cannot be greater than last code")
    end

    it "allows first_code equal to last_code (single code range)" do
      center_type = build(:accounting_center_type, organization: organization, first_code: "005", last_code: "005")
      expect(center_type).to be_valid
    end

    describe "code range overlap validation" do
      before do
        create(:accounting_center_type, organization: organization, first_code: "001", last_code: "050")
      end

      it "is invalid when the new range overlaps the lower end" do
        center_type = build(:accounting_center_type, organization: organization, first_code: "040", last_code: "060")
        expect(center_type).not_to be_valid
        expect(center_type.errors[:base]).to include("code range overlaps with an existing center type")
      end

      it "is invalid when the new range overlaps the upper end" do
        center_type = build(:accounting_center_type, organization: organization, first_code: "000", last_code: "010")
        expect(center_type).not_to be_valid
        expect(center_type.errors[:base]).to include("code range overlaps with an existing center type")
      end

      it "is invalid when the new range is fully contained within an existing range" do
        center_type = build(:accounting_center_type, organization: organization, first_code: "010", last_code: "020")
        expect(center_type).not_to be_valid
        expect(center_type.errors[:base]).to include("code range overlaps with an existing center type")
      end

      it "is invalid when the new range fully contains an existing range" do
        center_type = build(:accounting_center_type, organization: organization, first_code: "000", last_code: "100")
        expect(center_type).not_to be_valid
        expect(center_type.errors[:base]).to include("code range overlaps with an existing center type")
      end

      it "is invalid when the new range touches the boundary (inclusive)" do
        center_type = build(:accounting_center_type, organization: organization, first_code: "050", last_code: "100")
        expect(center_type).not_to be_valid
        expect(center_type.errors[:base]).to include("code range overlaps with an existing center type")
      end

      it "is valid when the new range is completely after the existing range" do
        center_type = build(:accounting_center_type, organization: organization, first_code: "051", last_code: "100", name: { en: "Bank accounts" })
        expect(center_type).to be_valid
      end

      it "is valid when the new range is completely before the existing range" do
        center_type = build(:accounting_center_type, organization: organization, first_code: "000", last_code: "000", name: { en: "Bank accounts" })
        expect(center_type).to be_valid
      end

      it "does not flag overlap against itself on update" do
        existing = Accounting::CenterType.last
        existing.update!(last_code: "060")
        expect(existing).to be_valid
      end
    end
  end

  describe "PaperTrail" do
    it { should be_versioned }

    it "tracks changes to center type attributes" do
      center_type = create(:accounting_center_type, organization: organization)

      PaperTrail.enabled = true

      expect {
        center_type.update!(auto_increment: false)
      }.to change { center_type.versions.count }.by(1)

      version = center_type.versions.last
      expect(version).not_to be_nil
      expect(version.event).to eq("update")
      expect(version.item_type).to eq("Accounting::CenterType")
      expect(version.item_id).to eq(center_type.id)
    end
  end

  describe "translations" do
    it "supports name translations" do
      center_type = create(:accounting_center_type, organization: organization,
                           name: { "en" => "Cost Centers", "fa" => "مراکز هزینه" })

      Mobility.with_locale(:en) { expect(center_type.name).to eq("Cost Centers") }
      Mobility.with_locale(:fa) { expect(center_type.name).to eq("مراکز هزینه") }
    end

    it "uses fallbacks if translation is missing" do
      center_type = create(:accounting_center_type, organization: organization, name: { "en" => "Revenue Centers" })

      Mobility.with_locale(:fa) { expect(center_type.name).to eq("Revenue Centers") }
    end
  end
end
