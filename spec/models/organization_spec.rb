require 'rails_helper'
require 'securerandom'

RSpec.describe Organization, type: :model do
  describe "database schema" do
    it { should have_db_column(:name).of_type(:jsonb).with_options(null: false) }
    it { should have_db_column(:description).of_type(:jsonb) }
    it { should have_db_column(:parent_id).of_type(:integer) }
    it { should have_db_column(:is_tenant).of_type(:boolean) }
    it { should have_db_column(:created_at).of_type(:datetime) }
    it { should have_db_column(:updated_at).of_type(:datetime) }

    it { should have_db_index(:name).using(:gin) }
    it { should have_db_index([ :parent_id ]) }
  end

  describe "validations" do
    it "is not valid with a name not containing at least one translation" do
      organization = FactoryBot.build(:organization, name: {})
      expect(organization).not_to be_valid
      expect(organization.errors[:name].join(". ")).to include("must contain at least one")
    end

    it "is valid with a name containing at least one translation" do
      organization = build(:organization, name: { en: "Marketing Department #{SecureRandom.uuid}" })
      expect(organization).to be_valid
    end

    it "validates uniqueness of name within organization" do
      test_org_name = "Test Organization Name #{SecureRandom.uuid}"
      parent_org = create(:organization)
      create(:organization, name: test_org_name, parent: parent_org)

      duplicate_org = build(:organization, name: test_org_name, parent: parent_org)
      expect(duplicate_org).not_to be_valid
      expect(duplicate_org.errors[:name]).to include(/has already been taken/)
    end

    it "prevents circular references" do
      parent_org = create(:organization)
      child_org = create(:organization, parent: parent_org)

      parent_org.parent_id = child_org.id
      expect(parent_org).not_to be_valid
      expect(parent_org.errors[:parent_id]).to include(/circular reference/)
    end
  end

  describe "associations" do
    it { should belong_to(:parent).class_name('Organization').optional(true) }
    it { should have_many(:children).class_name('Organization').with_foreign_key('parent_id') }
    it { should have_many(:departments) }
    it { should have_many(:groups) }
    it { should have_many(:roles) }
    it { should have_many(:members) }
  end

  describe "PaperTrail" do
    it { should be_versioned }

    it "tracks changes to organization attributes" do
      organization = create(:organization)

      PaperTrail.enabled = true

      new_name = "Updated Organization Name #{SecureRandom.uuid}"
      expect {
        Mobility.with_locale(:en) { organization.update!(name: new_name) }
      }.to change { organization.versions.count }.by(1)

      version = organization.versions.last
      expect(version).not_to be_nil
      expect(version.event).to eq("update")
      expect(version.item_type).to eq("Organization")
      expect(version.item_id).to eq(organization.id)
    end
  end

  describe "#ancestors" do
    let(:grandparent) { create(:organization, name: { en: "Grandparent Org #{SecureRandom.uuid}" }) }
    let(:parent) { create(:organization, name: { en: "Parent Org #{SecureRandom.uuid}" }, parent: grandparent) }
    let(:child) { create(:organization, name: { en: "Child Org #{SecureRandom.uuid}" }, parent: parent) }

    it "returns all ancestors in correct order" do
      expect(child.ancestors).to eq([ child, parent, grandparent ])
      expect(parent.ancestors).to eq([ parent, grandparent ])
      expect(grandparent.ancestors).to eq([ grandparent ])
    end
  end

  describe "translations" do
    it "supports name translations" do
      organization = create(:organization, name: { "en" => "Main Office", "fa" => "دفتر مرکزی" })

      Mobility.with_locale(:en) do
        expect(organization.name).to eq("Main Office")
      end

      Mobility.with_locale(:fa) do
        expect(organization.name).to eq("دفتر مرکزی")
      end
    end

    it "uses fallbacks if translation is missing" do
      organization = create(:organization, name: { "en" => "Head Office" })

      Mobility.with_locale(:fa) do
        expect(organization.name).to eq("Head Office") # Falls back to English
      end
    end

    it "initializes name as an empty hash if not set" do
      organization = Organization.new
      expect(organization.read_attribute(:name)).to eq({})
    end
  end
end
