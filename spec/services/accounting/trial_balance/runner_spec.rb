require "rails_helper"

RSpec.describe Accounting::TrialBalance::Runner do
  let(:organization) { create(:organization) }
  let(:setting) { organization.accounting_setting }
  let(:member) { create(:member, organization: organization, user: create(:user)) }
  let!(:year1) { create(:fiscal_year, organization: organization, start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31)) }
  let!(:year2) { create(:fiscal_year, organization: organization, start_date: Date.new(2025, 1, 1), finish_date: Date.new(2025, 12, 31)) }
  let(:bank) { create_account_in(organization, "CA", ledger_code: "10", name: "Bank") }
  let(:capital) { create_account_in(organization, "OE", ledger_code: "10", name: "Capital") }
  let(:retained) { create_account_in(organization, "OE", ledger_code: "30", name: "Retained") }
  let(:revenue) { create_account_in(organization, "RE", ledger_code: "10", name: "Sales") }
  let(:rent) { create_account_in(organization, "EX", ledger_code: "10", name: "Rent") }

  def payload(from:, to:, level: "account", hide_zero: true)
    runner = described_class.new(organization: organization, from: from, to: to, level: level)
    Accounting::TrialBalance::Payload.new(runner, runner.call, hide_zero: hide_zero).call
  end

  def row(result, name)
    result[:rows].find { |r| r[:name] == name }
  end

  before do
    setting.update!(closing_method: :direct, retained_earnings_account: retained)
    post_entry(fiscal_year: year1, date: Date.new(2024, 1, 1), entry_type: :beginning,
               lines: [ je_line(bank, debit: 500), je_line(capital, credit: 500) ])
    post_entry(fiscal_year: year1, date: Date.new(2024, 3, 1), lines: [ je_line(bank, debit: 300), je_line(revenue, credit: 300) ])
    post_entry(fiscal_year: year1, date: Date.new(2024, 6, 1), lines: [ je_line(rent, debit: 100), je_line(bank, credit: 100) ])
    post_entry(fiscal_year: year2, date: Date.new(2025, 2, 1), lines: [ je_line(bank, debit: 50), je_line(revenue, credit: 50) ])
  end

  it "opens the first year with its beginning entry" do
    result = payload(from: Date.new(2024, 1, 1), to: Date.new(2024, 12, 31))

    expect(row(result, "Bank")).to include(opening_debit: "500.0", debit: "300.0", credit: "100.0", closing_debit: "700.0")
    expect(row(result, "Sales")).to include(opening_credit: "0.0", credit: "300.0", closing_credit: "300.0")
    expect(result[:totals]).to include(opening_debit: "500.0", opening_credit: "500.0", closing_debit: "800.0", closing_credit: "800.0")
    expect(result[:checks]).to be_empty
  end

  it "carries balances into later years and shows earlier results on their own row, closed or not" do
    expectations = lambda do |result|
      expect(row(result, "Bank")).to include(opening_debit: "700.0", debit: "50.0", closing_debit: "750.0")
      expect(row(result, "Sales")).to include(opening_credit: "0.0", credit: "50.0")
      expect(result[:rows].find { |r| r[:prior_result] }).to include(opening_credit: "200.0")
      expect(result[:checks]).to be_empty
    end
    expectations.call(payload(from: Date.new(2025, 1, 1), to: Date.new(2025, 12, 31)))

    start_closing!(year1, member: member)
    Accounting::Closing::RevaluationStep.new(year1.reload, member: member).complete!
    temp = Accounting::Closing::TempClosing.new(year1.reload, member: member)
    temp.post!(checksum: temp.plan.checksum)
    ending = Accounting::Closing::EndingEntry.new(year1.reload, member: member)
    ending.post!(checksum: ending.plan.checksum)
    Accounting::Closing::BeginningEntry.new(year1.reload, member: member).post!

    expectations.call(payload(from: Date.new(2025, 1, 1), to: Date.new(2025, 12, 31)))
  end

  it "opens mid-year with the year's movements so far" do
    result = payload(from: Date.new(2024, 4, 1), to: Date.new(2024, 12, 31))
    expect(row(result, "Bank")).to include(opening_debit: "800.0", credit: "100.0", closing_debit: "700.0")
    expect(row(result, "Sales")).to include(opening_credit: "300.0", credit: "0.0")
  end

  it "groups by ledger and category" do
    result = payload(from: Date.new(2024, 1, 1), to: Date.new(2024, 12, 31), level: "category")
    expect(result[:rows].map { |r| r[:code] }).to eq(%w[1 5 6 7])
  end
end
