# spec/models/accounting/journal_entry_spec.rb
require 'rails_helper'
require 'securerandom'

RSpec.describe Accounting::JournalEntry, type: :model do
  describe "database schema" do
    it { should have_db_column(:date).of_type(:date).with_options(null: false) }
    it { should have_db_column(:effective_date).of_type(:date).with_options(null: false) }
    it { should have_db_column(:fiscal_year_id).of_type(:integer).with_options(null: false) }
    it { should have_db_column(:no).of_type(:string).with_options(null: false) }
    it { should have_db_column(:ref).of_type(:string).with_options(null: false) }
    it { should have_db_column(:daily_no).of_type(:integer).with_options(null: false) }
    it { should have_db_column(:state).of_type(:integer).with_options(null: false) }
    it { should have_db_column(:entry_type).of_type(:integer).with_options(null: false) }
    it { should have_db_column(:description).of_type(:jsonb).with_options(null: false, default: {}) }
    it { should have_db_column(:debit).of_type(:decimal) }
    it { should have_db_column(:credit).of_type(:decimal) }
    it { should have_db_column(:organization_id).of_type(:integer).with_options(null: false) }
    it { should have_db_column(:creator_id).of_type(:integer) }
  end

  let(:organization) { create(:organization, name: { en: "JE Org #{SecureRandom.uuid}" }) }

  let(:account_category) { organization.account_categories.find_by!(identifier: "CA") }
  let(:ledger) { create(:accounting_ledger, account_category: account_category, code: "10") }
  let!(:account) do
    create(:accounting_account, ledger: ledger, code: "01", name: { en: "Cash" })
  end

  describe "associations" do
    it { should belong_to(:organization) }
    it { should belong_to(:fiscal_year) }
    it { should belong_to(:creator).optional(true) }
    it { should have_many(:items).dependent(:destroy) }
  end

  describe "enums" do
    it "defines expected states" do
      expect(Accounting::JournalEntry.states.keys).to contain_exactly("draft", "booked", "approved")
      expect(Accounting::JournalEntry.states.values).to contain_exactly(0, 1, 2)
    end

    it "defines expected entry_types" do
      expect(Accounting::JournalEntry.entry_types.keys).to contain_exactly("normal", "beginning", "ending")
      expect(Accounting::JournalEntry.entry_types.values).to contain_exactly(0, 1, 2)
    end
  end

  describe "validations" do
    it "validates presence of date" do
      je = build(:accounting_journal_entry, organization: organization, date: nil)
      expect(je).not_to be_valid
      expect(je.errors[:date]).to include("can't be blank")
    end

    it "validates presence of fiscal_year" do
      je = build(:accounting_journal_entry, organization: organization, fiscal_year: nil)
      expect(je).not_to be_valid
      expect(je.errors[:fiscal_year]).to include("must exist")
    end

    it "is invalid when date is outside fiscal year" do
      fy = create(:fiscal_year, organization: organization,
                  start_date: Date.new(2024, 1, 1),
                  finish_date: Date.new(2024, 12, 31))

      je = build(:accounting_journal_entry, organization: organization,
                 fiscal_year: fy, date: Date.new(2023, 12, 31))
      expect(je).not_to be_valid
      expect(je.errors[:date]).to include(/must be within the fiscal year/)
    end

    it "is valid when date is within fiscal year" do
      fy = create(:fiscal_year, organization: organization,
                  start_date: Date.new(2024, 1, 1),
                  finish_date: Date.new(2024, 12, 31))

      je = build(:accounting_journal_entry, organization: organization,
                 fiscal_year: fy, date: Date.new(2024, 6, 15))
      expect(je).to be_valid
    end

    describe "booked/approved validations" do
      it "requires items for booked state" do
        je = build(:accounting_journal_entry, organization: organization, state: :booked)
        expect(je).not_to be_valid
        expect(je.errors[:base]).to include(/at least one item/)
      end

      it "requires balanced debit/credit for booked state" do
        je = build(:accounting_journal_entry, organization: organization, state: :booked)
        je.items.build(row: 1, account: account, debit: 100, credit: 0)
        je.items.build(row: 2, account: account, debit: 0, credit: 90)
        expect(je).not_to be_valid
        expect(je.errors[:base]).to include(/debit and credit totals must be equal/)
      end

      it "is valid for booked state with balanced items" do
        je = build(:accounting_journal_entry, organization: organization, state: :booked)
        je.items.build(row: 1, account: account, debit: 100, credit: 0)
        je.items.build(row: 2, account: account, debit: 0, credit: 100)
        expect(je).to be_valid
      end

      it "allows draft with no items" do
        je = build(:accounting_journal_entry, organization: organization, state: :draft)
        expect(je).to be_valid
      end
    end
  end

  describe "callbacks" do
    it "sets effective_date from date on create if blank" do
      fy = create(:fiscal_year, organization: organization,
                  start_date: Date.new(2024, 1, 1),
                  finish_date: Date.new(2024, 12, 31))
      je = create(:accounting_journal_entry, organization: organization,
                  fiscal_year: fy, date: Date.new(2024, 3, 1), effective_date: nil)
      expect(je.effective_date).to eq(Date.new(2024, 3, 1))
    end

    it "recalculates debit/credit totals before save" do
      je = create(:accounting_journal_entry, organization: organization, state: :draft)
      je.items.create!(row: 1, account: account, debit: 100, credit: 0)
      je.items.create!(row: 2, account: account, debit: 0, credit: 100)
      je.save!
      je.reload
      expect(je.debit).to eq(100)
      expect(je.credit).to eq(100)
    end

    it "assigns sequential no/ref/daily_no on create" do
      fy = create(:fiscal_year, organization: organization,
                  start_date: Date.new(2024, 1, 1),
                  finish_date: Date.new(2024, 12, 31))

      je1 = create(:accounting_journal_entry, organization: organization,
                   fiscal_year: fy, date: Date.new(2024, 1, 1))
      je2 = create(:accounting_journal_entry, organization: organization,
                   fiscal_year: fy, date: Date.new(2024, 1, 1))

      expect(je1.no).to eq("1")
      expect(je2.no).to eq("2")
      expect(je1.ref).to eq("1")
      expect(je2.ref).to eq("2")
      expect(je1.daily_no).to eq(1)
      expect(je2.daily_no).to eq(2)
    end
  end

  describe "PaperTrail" do
    it { should be_versioned }
  end

  describe "translations" do
    it "supports description translations" do
      je = create(:accounting_journal_entry, organization: organization,
                  description: { "en" => "Opening Entry", "fa" => "سند افتتاحیه" })

      Mobility.with_locale(:en) { expect(je.description).to eq("Opening Entry") }
      Mobility.with_locale(:fa) { expect(je.description).to eq("سند افتتاحیه") }
    end
  end
end
