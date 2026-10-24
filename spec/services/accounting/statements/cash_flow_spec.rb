require "rails_helper"

RSpec.describe "Statement of cash flows (indirect)" do
  let(:organization) { create(:organization) }
  let(:setting) { organization.accounting_setting }
  let(:member) { create(:member, organization: organization, user: create(:user)) }
  let(:eur) { create(:accounting_currency, organization: organization, abr: "EUR") }
  let!(:year) { create(:fiscal_year, organization: organization, start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31)) }
  let!(:year2) { create(:fiscal_year, organization: organization, start_date: Date.new(2025, 1, 1), finish_date: Date.new(2025, 12, 31)) }

  let(:bank) { create_account_in(organization, "CA", ledger_code: "10", monetary: true, name: "Bank") }
  let(:eur_bank) { create_account_in(organization, "CA", ledger_code: "10", account_code: "02", monetary: true, name: "EUR bank") }
  let(:receivables) { create_account_in(organization, "CA", ledger_code: "11", monetary: true, name: "Receivables") }
  let(:equipment) { create_account_in(organization, "LA", ledger_code: "20", name: "Equipment") }
  let(:depreciation) { create_account_in(organization, "LA", ledger_code: "21", name: "Accumulated depreciation") }
  let(:loan) { create_account_in(organization, "LL", ledger_code: "10", monetary: true, name: "Loan") }
  let(:capital) { create_account_in(organization, "OE", ledger_code: "10", name: "Capital") }
  let(:revenue) { create_account_in(organization, "RE", ledger_code: "10", name: "Sales") }
  let(:fx_gain) { create_account_in(organization, "RE", ledger_code: "90", name: "FX gain") }
  let(:fx_loss) { create_account_in(organization, "EX", ledger_code: "90", name: "FX loss") }
  let(:depreciation_expense) { create_account_in(organization, "EX", ledger_code: "20", name: "Depreciation expense") }

  let(:report) { Reporting::Reports::Copy.call(source: Reporting::Report.system.find_by!(key: "ifrs.cash_flow"), organization: organization) }
  let(:layout) { report.statement_layout }

  def line(key) = layout.lines.find_by!(key: key)

  def map(key, selector_type, selector, measure: "change")
    layout.rules.create!(line: line(key), selector_type: selector_type, selector: selector, measure: measure)
  end

  def run(from: year.start_date, to: year.finish_date)
    columns = Accounting::Statements::Runner.default_columns(report, from: from, to: to, comparison: false)
    Accounting::Statements::Runner.new(report: report, columns: columns).call
  end

  before do
    Accounting::Statements::Presets::Loader.call
    setting.update!(default_fx_gain_account: fx_gain, default_fx_loss_account: fx_loss)
    map("cash_movement", :ledger, { "ids" => [ bank.ledger_id ] })
    map("change_in_trade_and_other_receivables", :ledger, { "ids" => [ receivables.ledger_id ] })
    map("purchase_of_property_plant_and_equipment", :ledger, { "ids" => [ equipment.ledger_id ] }, measure: "debit_movement")
    map("depreciation_and_amortisation", :ledger, { "ids" => [ depreciation.ledger_id ] }, measure: "credit_movement")

    post_entry(fiscal_year: year, date: Date.new(2024, 1, 1), entry_type: :beginning,
               lines: [ je_line(bank, debit: 1000), je_line(capital, credit: 1000) ])
    # Credit sale 500, collected 300.
    post_entry(fiscal_year: year, date: Date.new(2024, 2, 1), lines: [ je_line(receivables, debit: 500), je_line(revenue, credit: 500) ])
    post_entry(fiscal_year: year, date: Date.new(2024, 3, 1), lines: [ je_line(bank, debit: 300), je_line(receivables, credit: 300) ])
    # Equipment bought for 400, depreciated 100.
    post_entry(fiscal_year: year, date: Date.new(2024, 4, 1), lines: [ je_line(equipment, debit: 400), je_line(bank, credit: 400) ])
    post_entry(fiscal_year: year, date: Date.new(2024, 12, 31), lines: [ je_line(depreciation_expense, debit: 100), je_line(depreciation, credit: 100) ])
    # Loan of 200.
    post_entry(fiscal_year: year, date: Date.new(2024, 5, 1), lines: [ je_line(bank, debit: 200), je_line(loan, credit: 200) ])
  end

  it "reconciles to the change in cash" do
    result = run
    value = ->(key) { result.value("current", key) }

    expect(value.call("profit_for_the_period")).to eq(400)
    expect(value.call("depreciation_and_amortisation")).to eq(100)
    expect(value.call("change_in_trade_and_other_receivables")).to eq(-200)
    expect(value.call("net_cash_from_operating_activities")).to eq(300)
    expect(value.call("purchase_of_property_plant_and_equipment")).to eq(-400)
    expect(value.call("net_cash_from_investing_activities")).to eq(-400)
    expect(value.call("net_cash_from_financing_activities")).to eq(200)
    expect(value.call("net_increase_in_cash")).to eq(100)
    expect(value.call("cash_at_beginning")).to eq(1000)
    expect(value.call("cash_at_end")).to eq(1100)
    expect(result.checks.map(&:code)).not_to include("not_balanced", "unmapped", "cash_not_mapped")
  end

  it "shows revaluations of cash as the effect of exchange rate changes" do
    post_entry(fiscal_year: year, date: Date.new(2024, 6, 1), lines: [
      je_line(eur_bank, debit: 110, currency: eur, rate: 1.1), je_line(revenue, credit: 110)
    ])
    create(:accounting_exchange_rate, organization: organization, currency: eur, date: Date.new(2024, 12, 31), rate: "1.25")
    revaluation = Accounting::CurrencyRevaluation.create!(organization: organization, fiscal_year: year, as_of_date: year.finish_date,
                                                          kind: :permanent, scope: {}, created_by: member)
    Accounting::Revaluation::Preparer.new(revaluation).call
    Accounting::Revaluation::Poster.new(revaluation.reload, member: member).call

    result = run
    expect(result.value("current", "effect_of_exchange_rate_changes")).to eq(15)
    expect(result.value("current", "profit_for_the_period")).to eq(510) # the unrealised gain isn't a cash flow
    expect(result.value("current", "cash_at_end")).to eq(1225)
    expect(result.checks.map(&:code)).not_to include("not_balanced", "unmapped")
  end

  it "opens later years with the cash at the end of the previous one" do
    post_entry(fiscal_year: year2, date: Date.new(2025, 2, 1), lines: [ je_line(bank, debit: 50), je_line(revenue, credit: 50) ])
    result = run(from: year2.start_date, to: year2.finish_date)
    expect(result.value("current", "cash_at_beginning")).to eq(1100)
    expect(result.value("current", "cash_at_end")).to eq(1150)
    expect(result.checks.map(&:code)).not_to include("not_balanced", "unmapped")
  end

  it "warns while the cash ledgers aren't mapped" do
    layout.rules.find_by!(statement_line_id: line("cash_movement").id).destroy!
    expect(run.checks.map(&:code)).to include("cash_not_mapped")
  end
end
