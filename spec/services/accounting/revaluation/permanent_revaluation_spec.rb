require "rails_helper"

RSpec.describe "Permanent currency revaluation" do
  let(:organization) { create(:organization) }
  let!(:usd) { organization.accounting_setting.main_currency }
  let(:eur) { create(:accounting_currency, organization: organization, abr: "EUR") }
  let(:member) { create(:member, organization: organization, user: create(:user)) }
  let(:fiscal_year) do
    create(:fiscal_year, organization: organization,
           start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31))
  end

  let(:bank) { create_account_in(organization, "CA", ledger_code: "10", monetary: true, name: "Bank") }
  let(:payable) { create_account_in(organization, "CL", ledger_code: "10", monetary: true, name: "Payable") }
  let(:inventory) { create_account_in(organization, "CA", ledger_code: "20", name: "Inventory") }
  let(:revenue) { create_account_in(organization, "RE", ledger_code: "10", name: "Sales") }
  let(:fx_gain) { create_account_in(organization, "RE", ledger_code: "90", name: "FX gain") }
  let(:fx_loss) { create_account_in(organization, "EX", ledger_code: "90", name: "FX loss") }

  def rate!(date, rate)
    create(:accounting_exchange_rate, organization: organization, currency: eur, date: date, rate: rate)
  end

  def revaluation(as_of, kind: :permanent, scope: {})
    record = Accounting::CurrencyRevaluation.create!(organization: organization, fiscal_year: fiscal_year,
                                                     as_of_date: as_of, kind: kind, scope: scope, created_by: member)
    Accounting::Revaluation::Preparer.new(record).call
    record.reload
  end

  def post!(record)
    Accounting::Revaluation::Poster.new(record, member: member).call
  end

  def item_for(record, account)
    record.items.find { |item| item.account_id == account.id }
  end

  def bank_balance
    Accounting::Balances::Query.new(organization: organization, fiscal_year: fiscal_year, account_ids: [ bank.id ])
                               .call.find { |row| row.currency_id == eur.id }
  end

  # A bank entry as a user would make it (fresh instance, no system context).
  def bank_entry(date, state: :booked, amount: 11)
    post_entry(fiscal_year: fiscal_year, date: date, state: state, lines: [
      je_line(bank, debit: amount, currency: eur, rate: 1.1), je_line(revenue, credit: amount)
    ])
  end

  def expect_error(key)
    expect { yield }.to raise_error(Accounting::Revaluation::Builder::Error) { |e| expect(e.key).to eq(key) }
  end

  before do
    organization.accounting_setting.update!(default_fx_gain_account: fx_gain, default_fx_loss_account: fx_loss)
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 3, 1), lines: [
      je_line(bank, debit: 110, currency: eur, rate: 1.1), je_line(revenue, credit: 110)
    ])
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 4, 1), lines: [
      je_line(inventory, debit: 50), je_line(payable, credit: 50, currency: eur, rate: 1)
    ])
    rate!(Date.new(2024, 6, 30), "1.25")
    rate!(Date.new(2024, 9, 30), "1.3")
  end

  describe "preview" do
    it "excludes combinations with unapproved entries dated on or before the date" do
      bank_entry(Date.new(2024, 6, 1), state: :booked)
      record = revaluation(Date.new(2024, 6, 30))

      expect(item_for(record, bank)).to have_attributes(excluded: true, excluded_reason: "blocked_by_unapproved")
      expect(item_for(record, payable)).to have_attributes(excluded: false)
    end

    it "ignores unapproved entries dated after the date" do
      bank_entry(Date.new(2024, 7, 1), state: :booked)
      expect(item_for(revaluation(Date.new(2024, 6, 30)), bank)).not_to be_excluded
    end

    it "doesn't block temporary revaluations" do
      bank_entry(Date.new(2024, 6, 1), state: :draft)
      expect(item_for(revaluation(Date.new(2024, 6, 30), kind: :temporary), bank)).not_to be_excluded
    end
  end

  describe "posting" do
    it "posts only the clean part and becomes stale when a blocking entry is approved" do
      blocking = bank_entry(Date.new(2024, 6, 1), state: :booked)
      record = revaluation(Date.new(2024, 6, 30))

      blocking.approve(member)
      expect_error(:stale) { post!(record) }

      record = revaluation(Date.new(2024, 6, 30))
      post!(record)
      expect(record.journal_entry.items.map(&:account_id)).to include(bank.id, payable.id)
    end

    it "adds only the incremental difference after an earlier permanent revaluation" do
      post!(revaluation(Date.new(2024, 6, 30)))
      expect(bank_balance.base_balance).to eq(125)

      later = revaluation(Date.new(2024, 9, 30))
      expect(item_for(later, bank)).to have_attributes(book_base_balance: 125, difference: 5)
      post!(later)
      expect(bank_balance.base_balance).to eq(130)
    end

    it "supersedes overlapping temporary revaluations of any date" do
      temporary = post!(revaluation(Date.new(2024, 9, 30), kind: :temporary))
      post!(revaluation(Date.new(2024, 6, 30)))

      expect(temporary.reload).to be_superseded
      expect(bank_balance.base_balance).to eq(125)
    end

    it "excludes balances locked by a permanent revaluation dated on or after it" do
      post!(revaluation(Date.new(2024, 9, 30)))

      earlier = revaluation(Date.new(2024, 6, 30), kind: :temporary)
      expect(earlier.items).to all(have_attributes(excluded: true, excluded_reason: "locked_by_permanent"))
    end
  end

  describe "lock on journal entries" do
    before { post!(revaluation(Date.new(2024, 6, 30), scope: { "account_ids" => [ bank.id ] })) }

    it "blocks creating entries in scope dated on or before the date" do
      entry = build(:accounting_journal_entry, organization: organization, fiscal_year: fiscal_year,
                    date: Date.new(2024, 6, 30), state: :booked)
      entry.items.build(row: 1, account: bank, debit: 11, currency: eur, rate: 1.1)
      entry.items.build(row: 2, account: revenue, credit: 11, rate: nil)

      expect(entry).not_to be_valid
      expect(entry.errors[:base].join).to include("permanent revaluation as of 2024-06-30")
    end

    it "allows entries dated after the date, out of scope, in the main currency or as drafts" do
      expect { bank_entry(Date.new(2024, 7, 1)) }.not_to raise_error
      expect do
        post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 5, 1), lines: [
          je_line(payable, debit: 10, currency: eur, rate: 1), je_line(inventory, credit: 10)
        ])
      end.not_to raise_error
      expect do
        post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 5, 1), lines: [
          je_line(bank, debit: 10), je_line(revenue, credit: 10)
        ])
      end.not_to raise_error
      expect { bank_entry(Date.new(2024, 5, 1), state: :draft) }.not_to raise_error
    end

    it "blocks booking a draft dated in the locked period" do
      draft = bank_entry(Date.new(2024, 5, 1), state: :draft)
      loaded = Accounting::JournalEntry.find(draft.id)
      expect(loaded.update(state: :booked)).to be(false)
    end

    it "blocks changing, unapproving and deleting locked entries" do
      original = Accounting::JournalEntry.joins(:items).where(journal_entry_items: { account_id: bank.id },
                                                               date: Date.new(2024, 3, 1)).first
      loaded = Accounting::JournalEntry.includes(:items).find(original.id)
      expect(loaded.lock_reason).to include("permanent revaluation")
      expect(loaded.unapprove).to be(false)
      expect(Accounting::JournalEntry.find(original.id).destroy).to be(false)
    end

    it "blocks moving a locked item to a later date or another account" do
      original = Accounting::JournalEntry.joins(:items).where(journal_entry_items: { account_id: bank.id },
                                                               date: Date.new(2024, 3, 1)).first
      original.update_column(:state, Accounting::JournalEntry.states[:booked])
      loaded = Accounting::JournalEntry.includes(:items).find(original.id)
      loaded.date = Date.new(2024, 8, 1)
      expect(loaded).not_to be_valid
    end
  end

  describe "kind toggling and removal" do
    def toggle(record, kind)
      Accounting::Revaluation::KindToggler.new(record, kind: kind).call
    end

    it "makes a temporary revaluation permanent when its balances are approved" do
      record = post!(revaluation(Date.new(2024, 6, 30), kind: :temporary))
      toggle(record, :permanent)
      expect(record.reload).to be_permanent
      expect(Accounting::Revaluation::PermanentLocks.new(organization).revaluations).to eq([ record ])
    end

    it "refuses to make a temporary revaluation permanent with unapproved entries" do
      record = post!(revaluation(Date.new(2024, 6, 30), kind: :temporary))
      bank_entry(Date.new(2024, 6, 1), state: :booked)
      expect_error(:unapproved_entries) { toggle(record, :permanent) }
    end

    it "only lets the latest permanent revaluation become temporary or be deleted" do
      first = post!(revaluation(Date.new(2024, 6, 30)))
      second = post!(revaluation(Date.new(2024, 9, 30)))

      expect_error(:later_permanent_exists) { toggle(first, :temporary) }
      expect_error(:later_permanent_exists) { Accounting::Revaluation::Remover.new(first).call }

      toggle(second, :temporary)
      expect(second.reload).to be_temporary
      Accounting::Revaluation::Remover.new(first).call
      expect(Accounting::CurrencyRevaluation.exists?(first.id)).to be(false)
    end

    it "unlocks entries when the permanent revaluation is deleted" do
      record = post!(revaluation(Date.new(2024, 6, 30)))
      expect { bank_entry(Date.new(2024, 6, 1)) }.to raise_error(ActiveRecord::RecordInvalid)

      Accounting::Revaluation::Remover.new(record).call
      expect { bank_entry(Date.new(2024, 6, 1)) }.not_to raise_error
    end
  end
end
