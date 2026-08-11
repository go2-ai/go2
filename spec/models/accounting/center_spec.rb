# spec/models/accounting/center_spec.rb
require 'rails_helper'
require 'securerandom'

RSpec.describe Accounting::Center, type: :model do
  describe "database schema" do
    it { should have_db_column(:name).of_type(:jsonb).with_options(null: false, default: {}) }
    it { should have_db_column(:code).of_type(:string) }
    it { should have_db_column(:metadata).of_type(:jsonb).with_options(null: false, default: {}) }
    it { should have_db_column(:center_type_id).of_type(:integer).with_options(null: false) }
    it { should have_db_column(:centerable_type).of_type(:string) }
    it { should have_db_column(:centerable_id).of_type(:integer) }
    it { should have_db_column(:created_at).of_type(:datetime) }
    it { should have_db_column(:updated_at).of_type(:datetime) }

    it { should have_db_index(:name).using(:gin) }
    it { should have_db_index(:center_type_id) }
    it { should have_db_index(:code) }
  end

  let(:organization) { create(:organization, name: { en: "Center Org #{SecureRandom.uuid}" }) }
  let(:center_type) do
    create(:accounting_center_type, organization: organization,
           first_code: "000001", last_code: "000050")
  end

  describe "associations" do
    it { should belong_to(:center_type).class_name('Accounting::CenterType') }
    it { should belong_to(:centerable).optional(true) }
  end

  describe "delegations" do
    it "delegates organization to center_type" do
      center = build(:accounting_center, center_type: center_type, organization: organization)
      expect(center.organization).to eq(organization)
    end
  end

  describe "validations" do
    it "is not valid with a name not containing at least one translation" do
      center = build(:accounting_center, center_type: center_type, organization: organization, name: {})
      expect(center).not_to be_valid
      expect(center.errors[:name].join(", ")).to include("must contain at least one")
    end

    it "is valid with a name containing at least one translation" do
      center = build(:accounting_center, center_type: center_type, organization: organization, name: { en: "Main Warehouse" })
      expect(center).to be_valid
    end

    it "validates presence of code" do
      center = build(:accounting_center, center_type: center_type, organization: organization, code: nil)
      expect(center).not_to be_valid
      expect(center.errors[:code]).to include("can't be blank")
    end

    describe "code validation" do
      it "is valid when code is within the center type range" do
        center = build(:accounting_center, center_type: center_type, organization: organization, code: "000025")
        expect(center).to be_valid
      end

      it "is valid when code equals the first_code" do
        center = build(:accounting_center, center_type: center_type, organization: organization, code: "000001")
        expect(center).to be_valid
      end

      it "is valid when code equals the last_code" do
        center = build(:accounting_center, center_type: center_type, organization: organization, code: "000050")
        expect(center).to be_valid
      end

      it "is invalid when code is below the first_code" do
        center = build(:accounting_center, center_type: center_type, organization: organization, code: "000000")
        expect(center).not_to be_valid
        expect(center.errors[:code]).to include(/must be between/)
      end

      it "is invalid when code is above the last_code" do
        center = build(:accounting_center, center_type: center_type, organization: organization, code: "000051")
        expect(center).not_to be_valid
        expect(center.errors[:code]).to include(/must be between/)
      end

      it "is invalid when code length does not match accounting setting center_length" do
        center = build(:accounting_center, center_type: center_type, organization: organization, code: "001")
        expect(center).not_to be_valid
        expect(center.errors[:code]).to include(/must be exactly/)
      end

      it "is valid with correct length and within range" do
        center = build(:accounting_center, center_type: center_type, organization: organization,
                       code: "000025", name: { en: "Valid Center" })
        expect(center).to be_valid
      end
    end
  end

  describe "PaperTrail" do
    it { should be_versioned }

    it "tracks changes to center attributes" do
      center = create(:accounting_center, center_type: center_type, organization: organization)

      PaperTrail.enabled = true

      expect {
        Mobility.with_locale(:en) { center.update!(name: "Updated Center Name") }
      }.to change { center.versions.count }.by(1)

      version = center.versions.last
      expect(version).not_to be_nil
      expect(version.event).to eq("update")
      expect(version.item_type).to eq("Accounting::Center")
      expect(version.item_id).to eq(center.id)
    end
  end

  describe "metadata" do
    it "stores field values as a hash keyed by field id" do
      center = create(:accounting_center, center_type: center_type, organization: organization,
                      metadata: { "swift_code" => "AABBCC", "age" => 25 })

      expect(center.metadata).to be_a(Hash)
      expect(center.metadata["swift_code"]).to eq("AABBCC")
      expect(center.metadata["age"]).to eq(25)
    end

    it "defaults to an empty hash" do
      center = build(:accounting_center, center_type: center_type, organization: organization, metadata: nil)
      # Before DB default, the factory after(:build) ensures it's an empty hash
      expect(center.metadata).to eq({})
    end
  end

  describe "translations" do
    it "supports name translations" do
      center = create(:accounting_center, center_type: center_type, organization: organization,
                      name: { "en" => "Main Warehouse", "fa" => "انبار اصلی" })

      Mobility.with_locale(:en) { expect(center.name).to eq("Main Warehouse") }
      Mobility.with_locale(:fa) { expect(center.name).to eq("انبار اصلی") }
    end

    it "uses fallbacks if translation is missing" do
      center = create(:accounting_center, center_type: center_type, organization: organization,
                      name: { "en" => "Branch Office" })

      Mobility.with_locale(:fa) { expect(center.name).to eq("Branch Office") }
    end
  end
end
