# spec/models/accounting/account_category_spec.rb
require 'rails_helper'
require 'securerandom'

RSpec.describe Accounting::AccountCategory, type: :model do
  describe "database schema" do
    it { should have_db_column(:code).of_type(:string).with_options(null: false) }
    it { should have_db_column(:name).of_type(:jsonb).with_options(null: false, default: {}) }
    it { should have_db_column(:type).of_type(:integer).with_options(null: false) }
    it { should have_db_column(:organization_id).of_type(:integer).with_options(null: false) }
    it { should have_db_column(:identifier).of_type(:string) }
    it { should have_db_column(:created_at).of_type(:datetime) }
    it { should have_db_column(:updated_at).of_type(:datetime) }

    it { should have_db_index(:code) }
    it { should have_db_index(:name).using(:gin) }
    it { should have_db_index(:organization_id) }
    it { should have_db_index(:identifier) }
  end

  let(:organization) { create(:organization, name: { en: "AccountCategory Org #{SecureRandom.uuid}" }) }

  describe "associations" do
    it { should have_many(:ledgers).dependent(:destroy) }
    it { should have_many(:accounts).through(:ledgers) }
  end

  describe "validations" do
    it "validates presence of code" do
      category = build(:accounting_account_category, organization: organization, code: nil)
      expect(category).not_to be_valid
      expect(category.errors[:code]).to include("can't be blank")
    end

    it "validates uniqueness of code within organization scope" do
      create(:accounting_account_category, organization: organization, code: 0, type: :other)

      duplicate = build(:accounting_account_category, organization: organization, code: 0, type: :other)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:code]).to include("has already been taken")
    end

    it "allows the same code in a different organization" do
      create(:accounting_account_category, organization: organization, code: 0, type: :other)

      other_org = create(:organization, name: { en: "Other AccountCategory Org #{SecureRandom.uuid}" })
      other_category = build(:accounting_account_category, organization: other_org, code: 0, type: :other)
      expect(other_category).to be_valid
    end

    describe "type validation" do
      it "allows only :other type for user-created categories without identifier" do
        category = build(:accounting_account_category, organization: organization, identifier: nil, type: :balance_sheet)
        expect(category).not_to be_valid
        expect(category.errors[:base]).to include(/Can't create/)
      end

      it "allows :other type for user-created categories" do
        category = build(:accounting_account_category, organization: organization, identifier: nil, type: :other, code: 0)
        expect(category).to be_valid
      end

      it "allows system categories with any type" do
        category = build(:accounting_account_category, organization: organization, identifier: "CA", type: :balance_sheet, code: 0)
        expect(category).to be_valid
      end
    end
  end

  describe ".system_categories" do
    it "defines 9 system categories" do
      expect(Accounting::AccountCategory.system_categories.length).to eq(9)
    end

    it "each has required keys" do
      Accounting::AccountCategory.system_categories.each do |cat|
        expect(cat).to have_key(:identifier)
        expect(cat).to have_key(:name)
        expect(cat).to have_key(:code)
        expect(cat).to have_key(:type)
      end
    end

    it "contains expected identifiers" do
      identifiers = Accounting::AccountCategory.system_categories.map { |c| c[:identifier] }
      expect(identifiers).to contain_exactly("CA", "LA", "CL", "LL", "OE", "RE", "EX", "CO", "ME")
    end

    it "resolves names under the current locale" do
      I18n.with_locale(:fa) do
        expect(Accounting::AccountCategory.system_categories.first[:name]).to eq("دارایی‌های جاری")
      end
    end
  end

  describe "deletion prevention" do
    it "prevents deletion of system categories" do
      category = organization.account_categories.find_by!(identifier: "CA")

      expect { category.destroy }.not_to change { Accounting::AccountCategory.count }
      expect(category.errors[:base]).to include("System account categories cannot be deleted.")
    end

    it "allows deletion of user-created categories" do
      category = create(:accounting_account_category, organization: organization, identifier: nil, type: :other, code: 0)

      expect { category.destroy }.to change { Accounting::AccountCategory.count }.by(-1)
    end
  end

  describe "PaperTrail" do
    it { should be_versioned }

    it "tracks changes to account category attributes" do
      category = create(:accounting_account_category, organization: organization, code: 0, type: :other)

      PaperTrail.enabled = true

      expect {
        Mobility.with_locale(:en) { category.update!(name: "Updated Category Name") }
      }.to change { category.versions.count }.by(1)

      version = category.versions.last
      expect(version).not_to be_nil
      expect(version.event).to eq("update")
      expect(version.item_type).to eq("Accounting::AccountCategory")
      expect(version.item_id).to eq(category.id)
    end
  end

  describe "translations" do
    it "supports name translations" do
      category = create(:accounting_account_category, organization: organization, code: 0,
                        name: { "en" => "Current Assets", "fa" => "دارایی‌های جاری" })

      Mobility.with_locale(:en) { expect(category.name).to eq("Current Assets") }
      Mobility.with_locale(:fa) { expect(category.name).to eq("دارایی‌های جاری") }
    end

    it "uses fallbacks if translation is missing" do
      category = create(:accounting_account_category, organization: organization, code: 0,
                        name: { "en" => "Revenues" })

      Mobility.with_locale(:fa) { expect(category.name).to eq("Revenues") }
    end
  end

  describe "enum" do
    it "defines the expected types" do
      expect(Accounting::AccountCategory.types.keys).to contain_exactly("balance_sheet", "income_statement", "other")
      expect(Accounting::AccountCategory.types.values).to contain_exactly(1, 2, 3)
    end
  end
end
