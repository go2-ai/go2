# spec/models/accounting/ledger_spec.rb
require 'rails_helper'
require 'securerandom'

RSpec.describe Accounting::Ledger, type: :model do
  describe "database schema" do
    it { should have_db_column(:account_category_id).of_type(:integer).with_options(null: false) }
    it { should have_db_column(:code).of_type(:string).with_options(null: false) }
    it { should have_db_column(:name).of_type(:jsonb).with_options(null: false, default: {}) }
    it { should have_db_column(:contra_for_id).of_type(:integer) }
    it { should have_db_column(:unexpected_balance).of_type(:integer).with_options(null: false) }
    it { should have_db_column(:is_monetary).of_type(:boolean) }
    it { should have_db_column(:created_at).of_type(:datetime) }
    it { should have_db_column(:updated_at).of_type(:datetime) }

    it { should have_db_index(:account_category_id) }
    it { should have_db_index(:code).unique(true) }
    it { should have_db_index(:contra_for_id) }
  end

  let(:organization) { create(:organization, name: { en: "Ledger Org #{SecureRandom.uuid}" }) }
  let!(:account_category) { organization.account_categories.find_by!(identifier: "CA") }

  describe "associations" do
    subject { build(:accounting_ledger, account_category: account_category) }

    it { should belong_to(:parent_ledger).class_name('Accounting::Ledger').with_foreign_key('contra_for_id').optional(true) }
    it { should have_many(:contra_ledgers).class_name('Accounting::Ledger').with_foreign_key('contra_for_id').dependent(:destroy) }
    it { should have_many(:accounts).class_name('Account').dependent(:destroy) }
  end

  describe "delegations" do
    it "delegates organization to account_category" do
      ledger = build(:accounting_ledger, account_category: account_category)
      expect(ledger.organization).to eq(organization)
    end
  end

  describe "validations" do
    it "validates presence of code" do
      ledger = build(:accounting_ledger, account_category: account_category, code: nil)
      expect(ledger).not_to be_valid
      expect(ledger.errors[:code]).to include("can't be blank")
    end

    it "validates uniqueness of code within account_category scope" do
      code = "10"
      create(:accounting_ledger, account_category: account_category, code: code)

      duplicate = build(:accounting_ledger, account_category: account_category, code: code)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:code]).to include("has already been taken")
    end

    it "allows same code in different account categories" do
      other_category = organization.account_categories.find_by!(identifier: "CL")
      code = "10"

      create(:accounting_ledger, account_category: account_category, code: code)
      other_ledger = build(:accounting_ledger, account_category: other_category, code: code)
      expect(other_ledger).to be_valid
    end

    describe "code length validation" do
      it "is valid when code length matches ledger_length" do
        ledger = build(:accounting_ledger, account_category: account_category, code: "10")
        expect(ledger).to be_valid
      end

      it "is invalid when code length does not match ledger_length" do
        ledger = build(:accounting_ledger, account_category: account_category, code: "1")
        expect(ledger).not_to be_valid
        expect(ledger.errors[:code]).to include(/must be exactly/)
      end

      it "is valid with custom ledger_length" do
        organization.accounting_setting.update!(ledger_length: 3)
        ledger = build(:accounting_ledger, account_category: account_category, code: "100")
        expect(ledger).to be_valid
      end
    end

    it "validates presence of unexpected_balance" do
      ledger = build(:accounting_ledger, account_category: account_category, unexpected_balance: nil)
      expect(ledger).not_to be_valid
      expect(ledger.errors[:unexpected_balance]).to include("can't be blank")
    end
  end

  describe "#balance_type" do
    it "returns debit for asset and expense categories" do
      ca_category = organization.account_categories.find_by!(identifier: "CA")
      ledger = build(:accounting_ledger, account_category: ca_category)
      expect(ledger.balance_type).to eq("debit")

      ex_category = organization.account_categories.find_by!(identifier: "EX")
      ledger = build(:accounting_ledger, account_category: ex_category)
      expect(ledger.balance_type).to eq("debit")
    end

    it "returns credit for liability, revenue, and equity categories" do
      cl_category = organization.account_categories.find_by!(identifier: "CL")
      ledger = build(:accounting_ledger, account_category: cl_category)
      expect(ledger.balance_type).to eq("credit")

      oe_category = organization.account_categories.find_by!(identifier: "OE")
      ledger = build(:accounting_ledger, account_category: oe_category)
      expect(ledger.balance_type).to eq("credit")
    end

    it "returns nil for control and memorandum categories" do
      co_category = organization.account_categories.find_by!(identifier: "CO")
      ledger = build(:accounting_ledger, account_category: co_category)
      expect(ledger.balance_type).to be_nil

      me_category = organization.account_categories.find_by!(identifier: "ME")
      ledger = build(:accounting_ledger, account_category: me_category)
      expect(ledger.balance_type).to be_nil
    end
  end

  describe "PaperTrail" do
    it { should be_versioned }

    it "tracks changes to ledger attributes" do
      code = "10"
      ledger = create(:accounting_ledger, account_category: account_category, code: code)

      PaperTrail.enabled = true

      expect {
        Mobility.with_locale(:en) { ledger.update!(name: "Updated Ledger Name") }
      }.to change { ledger.versions.count }.by(1)

      version = ledger.versions.last
      expect(version).not_to be_nil
      expect(version.event).to eq("update")
      expect(version.item_type).to eq("Accounting::Ledger")
      expect(version.item_id).to eq(ledger.id)
    end
  end

  describe "translations" do
    it "supports name translations" do
      code = "10"
      ledger = create(:accounting_ledger, account_category: account_category, code: code,
                      name: { "en" => "Cash", "fa" => "نقد" })

      Mobility.with_locale(:en) { expect(ledger.name).to eq("Cash") }
      Mobility.with_locale(:fa) { expect(ledger.name).to eq("نقد") }
    end

    it "uses fallbacks if translation is missing" do
      code = "10"
      ledger = create(:accounting_ledger, account_category: account_category, code: code,
                      name: { "en" => "Accounts Receivable" })

      Mobility.with_locale(:fa) { expect(ledger.name).to eq("Accounts Receivable") }
    end
  end

  describe "enum" do
    it "defines the expected unexpected_balance values" do
      expect(Accounting::Ledger.unexpected_balances.keys).to contain_exactly("accept", "warn", "disallow")
      expect(Accounting::Ledger.unexpected_balances.values).to contain_exactly(1, 2, 3)
    end
  end
end