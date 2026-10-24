require "rails_helper"

RSpec.describe Accounting::Statements::Runner do
  let(:organization) { create(:organization) }
  let(:setting) { organization.accounting_setting }
  let(:member) { create(:member, organization: organization, user: create(:user)) }
  let!(:year1) { create(:fiscal_year, organization: organization, start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31)) }
  let!(:year2) { create(:fiscal_year, organization: organization, start_date: Date.new(2025, 1, 1), finish_date: Date.new(2025, 12, 31)) }

  let(:bank) { create_account_in(organization, "CA", ledger_code: "10", monetary: true, name: "Bank") }
  let(:receivables) { create_account_in(organization, "CA", ledger_code: "11", monetary: true, name: "Receivables") }
  let(:capital) { create_account_in(organization, "OE", ledger_code: "10", name: "Capital") }
  let(:retained_earnings) { create_account_in(organization, "OE", ledger_code: "30", name: "Retained earnings") }
  let(:revenue) { create_account_in(organization, "RE", ledger_code: "10", name: "Sales") }
  let(:rent) { create_account_in(organization, "EX", ledger_code: "10", name: "Rent") }

  let(:bs) { Reporting::Reports::Copy.call(source: preset("ifrs.balance_sheet"), organization: organization) }
  let(:pl) { Reporting::Reports::Copy.call(source: preset("ifrs.income_statement"), organization: organization) }

  def preset(key) = Reporting::Report.system.find_by!(key: key)

  def run(report, **options)
    described_class.new(report: report, columns: described_class.default_columns(report, **options)).call
  end

  def close!(year)
    start_closing!(year, member: member)
    Accounting::Closing::RevaluationStep.new(year.reload, member: member).complete!
    temp = Accounting::Closing::TempClosing.new(year.reload, member: member)
    temp.post!(checksum: temp.plan.checksum)
    ending = Accounting::Closing::EndingEntry.new(year.reload, member: member)
    ending.post!(checksum: ending.plan.checksum)
    Accounting::Closing::BeginningEntry.new(year.reload, member: member).post!
    year.reload
  end

  before do
    Accounting::Statements::Presets::Loader.call
    setting.update!(closing_method: :direct, retained_earnings_account: retained_earnings)
    post_entry(fiscal_year: year1, date: Date.new(2024, 1, 2), lines: [ je_line(bank, debit: 500), je_line(capital, credit: 500) ])
    post_entry(fiscal_year: year1, date: Date.new(2024, 3, 1), lines: [ je_line(receivables, debit: 1000), je_line(revenue, credit: 1000) ])
    post_entry(fiscal_year: year1, date: Date.new(2024, 5, 1), lines: [ je_line(rent, debit: 300), je_line(bank, credit: 300) ])
  end

  it "computes a balanced statement of financial position" do
    result = run(bs, date: Date.new(2024, 12, 31), comparison: false)

    expect(result.value("current", "total_assets")).to eq(1200)
    expect(result.value("current", "profit_for_the_year")).to eq(700)
    expect(result.value("current", "total_equity_and_liabilities")).to eq(1200)
    expect(result.checks.map(&:code)).not_to include("not_balanced", "unmapped")
  end

  context "in the next year" do
    before do
      post_entry(fiscal_year: year2, date: Date.new(2025, 2, 1), lines: [ je_line(bank, debit: 200), je_line(revenue, credit: 200) ])
    end

    it "splits prior years' profit into retained earnings, closed or not" do
      open_result = run(bs, date: Date.new(2025, 12, 31))
      values = ->(result) { %w[retained_earnings profit_for_the_year total_assets].map { |key| result.value("current", key) } }
      expect(values.call(open_result)).to eq([ 700, 200, 1400 ])

      close!(year1)
      closed_result = run(bs, date: Date.new(2025, 12, 31))
      expect(values.call(closed_result)).to eq([ 700, 200, 1400 ])
      expect(closed_result.checks.map(&:code)).not_to include("not_balanced", "unmapped")
      # The comparison column (end of 2024) is unchanged by the closing.
      expect(closed_result.value("previous", "profit_for_the_year")).to eq(700)
      expect(closed_result.value("previous", "total_assets")).to eq(1200)
    end

    it "keeps closing entries out of profit or loss" do
      close!(year1)
      result = run(pl, from: Date.new(2024, 1, 1), to: Date.new(2024, 12, 31), comparison: false)
      expect(result.value("current", "revenue")).to eq(1000)
      expect(result.value("current", "profit_for_the_year")).to eq(700)
    end

    it "covers multi-year periods" do
      result = run(pl, from: Date.new(2024, 1, 1), to: Date.new(2025, 12, 31), comparison: false)
      expect(result.value("current", "profit_for_the_year")).to eq(900)
    end
  end

  it "reports unmapped balances and draft entries" do
    other = create_account_in(organization, "CA", ledger_code: "20", name: "Other")
    rule = bs.statement_layout.rules.find { |r| r.selector["identifiers"] == [ "CA" ] }
    rule.update!(selector_type: :ledger, selector: { "ids" => [ bank.ledger_id, receivables.ledger_id ] })
    post_entry(fiscal_year: year1, date: Date.new(2024, 6, 1), lines: [ je_line(other, debit: 5), je_line(bank, credit: 5) ])
    post_entry(fiscal_year: year1, date: Date.new(2024, 6, 2), state: :draft,
               lines: [ je_line(other, debit: 1), je_line(bank, credit: 1) ])

    result = run(bs, date: Date.new(2024, 12, 31), comparison: false)
    codes = result.checks.map(&:code)
    expect(codes).to include("unmapped", "not_balanced", "draft_entries")
    expect(result.engine("current").unmapped.map { |r| r.row.account_id }).to eq([ other.id ])
  end

  it "filters by approval" do
    post_entry(fiscal_year: year1, date: Date.new(2024, 7, 1), state: :booked,
               lines: [ je_line(bank, debit: 50), je_line(revenue, credit: 50) ])
    columns = described_class.default_columns(pl, from: year1.start_date, to: year1.finish_date, comparison: false)

    expect(described_class.new(report: pl, columns: columns).call.value("current", "revenue")).to eq(1050)
    expect(described_class.new(report: pl, columns: columns, approved_only: true).call.value("current", "revenue")).to eq(1000)
  end
end
