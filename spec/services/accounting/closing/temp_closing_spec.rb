require "rails_helper"

RSpec.describe "Fiscal year closing: close temporary accounts" do
  let(:organization) { create(:organization) }
  let(:setting) { organization.accounting_setting }
  let!(:usd) { setting.main_currency }
  let(:eur) { create(:accounting_currency, organization: organization, abr: "EUR") }
  let(:member) { create(:member, organization: organization, user: create(:user)) }
  let!(:fiscal_year) do
    create(:fiscal_year, organization: organization,
           start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31))
  end
  let!(:next_year) do
    create(:fiscal_year, organization: organization,
           start_date: Date.new(2025, 1, 1), finish_date: Date.new(2025, 12, 31))
  end
  let(:bank) { create_account_in(organization, "CA", ledger_code: "10", monetary: true, name: "Bank") }
  let(:revenue) { create_account_in(organization, "RE", ledger_code: "10", name: "Sales") }
  let(:expense) { create_account_in(organization, "EX", ledger_code: "10", name: "Rent") }
  let(:retained_earnings) { create_account_in(organization, "OE", ledger_code: "30", name: "Retained earnings") }
  let(:income_summary) { create_account_in(organization, "OE", ledger_code: "40", name: "Income summary") }
  let(:current_year_profit) { create_account_in(organization, "OE", ledger_code: "35", name: "Current year profit") }
  let(:center_type) { create(:accounting_center_type, organization: organization, first_code: "000001", last_code: "000050") }
  let(:branch_a) { create(:accounting_center, center_type: center_type, code: "000001") }
  let(:branch_b) { create(:accounting_center, center_type: center_type, code: "000002") }

  def sale!(amount, date: Date.new(2024, 3, 1), centers: {}, currency: nil, rate: nil)
    post_entry(fiscal_year: fiscal_year, date: date, lines: [
      je_line(bank, debit: amount), je_line(revenue, credit: amount, centers: centers, currency: currency, rate: rate)
    ])
  end

  def rent!(amount)
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 4, 1), lines: [
      je_line(expense, debit: amount), je_line(bank, credit: amount)
    ])
  end

  def to_temp_closing!(method: :direct, **accounts)
    setting.update!(closing_method: method, retained_earnings_account: retained_earnings, **accounts)
    start_closing!(fiscal_year, member: member)
    Accounting::Closing::RevaluationStep.new(fiscal_year.reload, member: member).complete!
    fiscal_year.reload
  end

  def service
    Accounting::Closing::TempClosing.new(fiscal_year.reload, member: member)
  end

  def post!
    plan = service.plan
    service.post!(checksum: plan.checksum)
  end

  def balances(account, **options)
    Accounting::Balances::Query.new(organization: organization, fiscal_year: fiscal_year, account_ids: [ account.id ],
                                    **options).call
  end

  def base_balance(account)
    balances(account).sum(BigDecimal("0"), &:base_balance)
  end

  def expect_closing_error(key)
    expect { yield }.to raise_error(Accounting::Closing::Error) { |e| expect(e.key).to eq(key) }
  end

  describe "direct method" do
    before do
      sale!(110)
      rent!(40)
      to_temp_closing!
    end

    it "previews one entry reversing each balance into retained earnings" do
      plan = service.plan
      expect(plan).to be_postable
      expect(plan.net_result).to eq(70)
      expect(plan.entries.map(&:kind)).to eq(%w[close_accounts])
      lines = plan.entries.first.lines.map { |l| [ l[:account_id], l[:debit], l[:credit] ] }
      expect(lines).to contain_exactly([ revenue.id, 110, 0 ], [ expense.id, 0, 40 ], [ retained_earnings.id, 0, 70 ])
    end

    it "posts an approved closing entry at the year end and moves to the ending step" do
      post!
      entry = fiscal_year.closing_entries.sole
      expect(entry).to have_attributes(entry_type: "closing_temp_accounts", state: "approved", date: Date.new(2024, 12, 31),
                                       approved_by: member, source: fiscal_year)
      expect(fiscal_year.reload.closing_step).to eq("ending")
      expect(fiscal_year.closing_data.dig("temp_closing", "entry_ids")).to eq([ entry.id ])
      expect(base_balance(revenue)).to eq(0)
      expect(base_balance(expense)).to eq(0)
      expect(base_balance(retained_earnings)).to eq(-70)
      expect(entry.items.find_by!(account: revenue).description)
        .to eq("Closing #{revenue.full_code} Sales at the end of fiscal year #{fiscal_year.name}")
      expect(entry.items.find_by!(account: retained_earnings))
        .to have_attributes(currency_amount: nil, description: "Result of fiscal year #{fiscal_year.name} closed into Retained earnings")
    end

    it "refuses a stale preview" do
      checksum = service.plan.checksum
      post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 5, 1), source: fiscal_year,
                 system_context: :fiscal_year_closing, entry_type: :closing_temp_accounts,
                 lines: [ je_line(bank, debit: 5), je_line(revenue, credit: 5) ])
      expect_closing_error(:stale) { service.post!(checksum: checksum) }
    end

    it "is only available at its step" do
      post!
      expect_closing_error(:wrong_step) { service.post!(checksum: "x") }
    end

    it "protects the closing entry from manual changes" do
      post!
      entry = Accounting::JournalEntry.find(fiscal_year.closing_entries.sole.id)
      expect(entry.destroy).to be(false)
    end
  end

  describe "foreign currencies" do
    it "closes the foreign balance with the base balance" do
      sale!(110, currency: eur, rate: 1.1)
      to_temp_closing!
      line = service.plan.entries.first.lines.find { |l| l[:account_id] == revenue.id }
      expect(line).to include(currency_id: eur.id, debit: 110, currency_amount: 100, rate: BigDecimal("1.1"))
      post!
      expect(balances(revenue, include_zero: true).map { |r| [ r.base_balance, r.currency_balance ] }).to eq([ [ 0, 0 ] ])
    end

    it "closes a foreign amount without base amount with a pair of lines" do
      post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 3, 1), lines: [
        je_line(revenue, debit: 110, currency: eur, rate: 1.1), je_line(revenue, credit: 110, currency: eur, rate: 1)
      ])
      to_temp_closing!
      lines = service.plan.entries.sole.lines
      expect(lines.map { |l| [ l[:account_id], l[:debit], l[:credit], l[:currency_amount] ] })
        .to eq([ [ revenue.id, BigDecimal("0.01"), 0, 10 ], [ revenue.id, 0, BigDecimal("0.01"), 0 ] ])
      post!
      expect(balances(revenue, include_zero: true).map { |r| [ r.base_balance, r.currency_balance ] }).to eq([ [ 0, 0 ] ])
    end

    it "closes opposite base and foreign signs" do
      # Base balance 10 credit, foreign balance 10 EUR debit.
      post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 3, 1), lines: [
        je_line(revenue, debit: 100, currency: eur, rate: 1), je_line(revenue, credit: 110, currency: eur, rate: 1.22222222222222),
        je_line(bank, debit: 10)
      ])
      row = balances(revenue).sole
      expect(row.base_balance).to eq(-10)
      expect(row.currency_balance).to be_positive
      to_temp_closing!
      post!
      expect(balances(revenue, include_zero: true).map { |r| [ r.base_balance, r.currency_balance ] }).to eq([ [ 0, 0 ] ])
    end
  end

  describe "centers" do
    before do
      revenue.update!(allowed_center_types_1: [ center_type.id ])
      sale!(100, centers: { 1 => branch_a })
      sale!(30, centers: { 1 => branch_b })
    end

    it "keeps the centers the target account allows" do
      retained_earnings.update!(allowed_center_types_1: [ center_type.id ])
      to_temp_closing!
      offsets = service.plan.entries.first.lines.select { |l| l[:account_id] == retained_earnings.id }
      expect(offsets.map { |l| [ l[:center1_id], l[:credit] ] }).to contain_exactly([ branch_a.id, 100 ], [ branch_b.id, 30 ])
    end

    it "nets offsets when the target account has no centers" do
      to_temp_closing!
      offsets = service.plan.entries.first.lines.select { |l| l[:account_id] == retained_earnings.id }
      expect(offsets.map { |l| [ l[:center1_id], l[:credit] ] }).to eq([ [ nil, 130 ] ])
    end

    it "blocks balances without a center the target account requires" do
      retained_earnings.update!(allowed_center_types_2: [ center_type.id ])
      to_temp_closing!
      plan = service.plan
      expect(plan).not_to be_postable
      expect(plan.problems.map { |p| p[:reason] }.uniq).to eq(%w[center_mismatch])
      expect_closing_error(:center_mismatch) { service.post!(checksum: plan.checksum) }
    end
  end

  describe "income summary method" do
    before do
      sale!(110)
      rent!(40)
      to_temp_closing!(method: :income_summary, income_summary_account: income_summary)
    end

    it "closes into the income summary, then the income summary into retained earnings" do
      plan = service.plan
      expect(plan.entries.map(&:kind)).to eq(%w[close_accounts close_income_summary])
      second = plan.entries.last.lines.map { |l| [ l[:account_id], l[:debit], l[:credit] ] }
      expect(second).to contain_exactly([ income_summary.id, 70, 0 ], [ retained_earnings.id, 0, 70 ])

      post!
      expect(fiscal_year.closing_entries.count).to eq(2)
      expect(base_balance(income_summary)).to eq(0)
      expect(base_balance(retained_earnings)).to eq(-70)
    end
  end

  describe "current year profit method" do
    it "closes into the current year profit account" do
      rent!(40)
      to_temp_closing!(method: :current_year_profit, current_year_profit_account: current_year_profit)
      post!
      expect(base_balance(current_year_profit)).to eq(40)
      expect(base_balance(retained_earnings)).to eq(0)
    end
  end

  it "moves on without an entry when there is nothing to close" do
    to_temp_closing!
    post!
    expect(fiscal_year.reload).to have_attributes(closing_step: "ending")
    expect(fiscal_year.closing_entries).to be_empty
  end

  describe Accounting::Closing::Rollback do
    before do
      sale!(110)
      to_temp_closing!
    end

    it "deletes the temporary closing entries when going back from the ending step" do
      post!
      Accounting::Closing::Rollback.new(fiscal_year.reload).call
      expect(fiscal_year.reload).to have_attributes(closing_step: "temp_closing")
      expect(fiscal_year.closing_entries).to be_empty
      expect(fiscal_year.closing_data).not_to have_key("temp_closing")
      expect(base_balance(revenue)).to eq(-110)
    end

    it "goes back to the revaluation step" do
      Accounting::Closing::Rollback.new(fiscal_year).call
      expect(fiscal_year.reload.closing_step).to eq("revaluation")
    end

    it "lets the closing be canceled while nothing is posted, but not after" do
      post!
      expect_closing_error(:roll_back_first) { Accounting::Closing::Canceler.new(fiscal_year.reload).call }
      Accounting::Closing::Rollback.new(fiscal_year.reload).call
      Accounting::Closing::Canceler.new(fiscal_year.reload).call
      expect(fiscal_year.reload).to be_open
    end
  end
end
