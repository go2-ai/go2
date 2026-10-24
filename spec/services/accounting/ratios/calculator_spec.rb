require "rails_helper"

RSpec.describe Accounting::Ratios::Calculator do
  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let!(:member) { create(:member, organization: organization, user: user) }
  let!(:year) { create(:fiscal_year, organization: organization, start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31)) }
  let(:bank) { create_account_in(organization, "CA", ledger_code: "10", name: "Bank") }
  let(:loan) { create_account_in(organization, "CL", ledger_code: "10", name: "Short loan") }
  let(:capital) { create_account_in(organization, "OE", ledger_code: "10", name: "Capital") }
  let(:revenue) { create_account_in(organization, "RE", ledger_code: "10", name: "Sales") }
  let(:access) { Reporting::Access.new(user, organization) }
  let(:bs) { Reporting::Report.system.find_by!(key: "ifrs.balance_sheet") }

  def calculate
    described_class.new(organization: organization, access: access, from: year.start_date, to: year.finish_date).call
  end

  def ratio(result, key) = result[:ratios].find { |r| r[:key] == key }

  before do
    Accounting::Statements::Presets::Loader.call
    post_entry(fiscal_year: year, date: Date.new(2024, 1, 1), entry_type: :beginning,
               lines: [ je_line(bank, debit: 600), je_line(capital, credit: 400), je_line(loan, credit: 200) ])
    post_entry(fiscal_year: year, date: Date.new(2024, 6, 1), lines: [ je_line(bank, debit: 200), je_line(revenue, credit: 200) ])
  end

  it "computes ratios from the statement lines, with their components" do
    create(:permission, code: Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES, grantee: member, organization: organization)
    result = calculate

    current = ratio(result, "current_ratio")
    expect(current[:values]["current"]).to eq("4.0") # 800 / 200
    expect(current[:components]["current"]).to eq("bs.current_assets" => "800.0", "bs.current_liabilities" => "200.0")
    expect(current[:component_lines]["bs.current_assets"]).to include(report_id: bs.id, line_key: "current_assets")
    expect(ratio(result, "net_margin")[:values]["current"]).to eq("1.0")
    # The period starts with the books, so the opening equals the closing balance: 200 / 600.
    expect(BigDecimal(ratio(result, "return_on_equity")[:values]["current"]).round(4)).to eq(BigDecimal("0.3333"))
    expect(ratio(result, "interest_coverage")[:reasons]["current"]).to eq("not_computable")
    expect(result[:columns].map { |c| c[:key] }).to eq([ "current" ])
  end

  it "leaves out ratios over statements the user can't see" do
    Reporting::ReportGrant.create!(organization: organization, report: bs, grantee: member)
    result = calculate
    expect(ratio(result, "current_ratio")[:values]["current"]).to eq("4.0")
    expect(ratio(result, "net_margin")[:reasons]["current"]).to eq("no_access")
    expect(ratio(result, "return_on_equity")[:reasons]["current"]).to eq("no_access")
  end
end
