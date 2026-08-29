# spec/models/accounting/journal_entry_item_spec.rb
require 'rails_helper'
require 'securerandom'

RSpec.describe Accounting::JournalEntryItem, type: :model do
  describe "database schema" do
    it { should have_db_column(:journal_entry_id).of_type(:integer).with_options(null: false) }
    it { should have_db_column(:row).of_type(:integer).with_options(null: false) }
    it { should have_db_column(:account_id).of_type(:integer) }
    it { should have_db_column(:center1_id).of_type(:integer) }
    it { should have_db_column(:center2_id).of_type(:integer) }
    it { should have_db_column(:center3_id).of_type(:integer) }
    it { should have_db_column(:center4_id).of_type(:integer) }
    it { should have_db_column(:center5_id).of_type(:integer) }
    it { should have_db_column(:center6_id).of_type(:integer) }
    it { should have_db_column(:debit).of_type(:decimal) }
    it { should have_db_column(:credit).of_type(:decimal) }
    it { should have_db_column(:currency_id).of_type(:integer).with_options(null: false) }
    it { should have_db_column(:rate).of_type(:decimal) }
    it { should have_db_column(:currency_amount).of_type(:decimal) }
  end

  let(:organization) { create(:organization, name: { en: "JEI Org #{SecureRandom.uuid}" }) }

  let(:account_category) { organization.account_categories.find_by!(identifier: "CA") }
  let(:ledger) { create(:accounting_ledger, account_category: account_category, code: "10") }
  let!(:account) do
    create(:accounting_account, ledger: ledger, code: "01", name: { en: "Cash" })
  end

  let(:draft_journal_entry) do
    create(:accounting_journal_entry, organization: organization, state: :draft)
  end

  describe "associations" do
    it { should belong_to(:journal_entry) }
    it { should belong_to(:account).optional(true) }
    it { should belong_to(:currency).optional(true) }
    it { should belong_to(:center1).optional(true) }
    it { should belong_to(:center2).optional(true) }
    it { should belong_to(:center3).optional(true) }
    it { should belong_to(:center4).optional(true) }
    it { should belong_to(:center5).optional(true) }
    it { should belong_to(:center6).optional(true) }
  end

  describe "validations" do
    it "validates presence of row" do
      item = build(:accounting_journal_entry_item, journal_entry: draft_journal_entry, row: nil)
      expect(item).not_to be_valid
      expect(item.errors[:row]).to include("can't be blank")
    end

    it "validates debit/credit are non-negative" do
      item = build(:accounting_journal_entry_item, journal_entry: draft_journal_entry,
                   debit: -1, credit: 0)
      expect(item).not_to be_valid
    end

    describe "debit XOR credit" do
      it "is invalid when both debit and credit are positive" do
        item = build(:accounting_journal_entry_item, journal_entry: draft_journal_entry,
                     debit: 100, credit: 50)
        expect(item).not_to be_valid
        expect(item.errors[:base]).to include(/only one of debit or credit/)
      end

      it "is invalid when both debit and credit are zero" do
        item = build(:accounting_journal_entry_item, journal_entry: draft_journal_entry,
                     debit: 0, credit: 0)
        expect(item).not_to be_valid
        expect(item.errors[:base]).to include(/debit or credit must be filled/)
      end

      it "is valid when only debit is positive" do
        item = build(:accounting_journal_entry_item, journal_entry: draft_journal_entry,
                     debit: 100, credit: 0)
        expect(item).to be_valid
      end

      it "is valid when only credit is positive" do
        item = build(:accounting_journal_entry_item, journal_entry: draft_journal_entry,
                     debit: 0, credit: 100)
        expect(item).to be_valid
      end
    end

    describe "account required for non-draft" do
      it "allows blank account for draft" do
        item = build(:accounting_journal_entry_item, journal_entry: draft_journal_entry,
                     account: nil, debit: 10, credit: 0)
        expect(item).to be_valid
      end

      it "requires account for booked" do
        # Create a draft JE first, then set state to booked in memory
        je = draft_journal_entry
        je.state = :booked

        item = build(:accounting_journal_entry_item, journal_entry: je,
                     account: nil, debit: 10, credit: 0)
        expect(item).not_to be_valid
        expect(item.errors[:account]).to include(/must be selected/)
      end
    end
  end

  describe "callbacks" do
    it "sets default currency and rate from accounting setting" do
      item = build(:accounting_journal_entry_item, journal_entry: draft_journal_entry,
                   currency: nil, rate: nil, debit: 100, credit: 0)
      item.valid?
      expect(item.currency).to eq(organization.accounting_setting.main_currency)
      expect(item.rate).to eq(1.0)
    end

    it "calculates currency_amount from debit/rate" do
      item = build(:accounting_journal_entry_item, journal_entry: draft_journal_entry,
                   debit: 200, credit: 0, rate: 2.0)
      item.valid?
      expect(item.currency_amount).to eq(100)
    end
  end

  describe "PaperTrail" do
    it { should be_versioned }
  end

  describe "translations" do
    it "supports description translations" do
      item = create(:accounting_journal_entry_item, journal_entry: draft_journal_entry,
                    account: account, debit: 10, credit: 0,
                    description: { "en" => "Cash deposit", "fa" => "واریز نقدی" })

      Mobility.with_locale(:en) { expect(item.description).to eq("Cash deposit") }
      Mobility.with_locale(:fa) { expect(item.description).to eq("واریز نقدی") }
    end
  end
end
