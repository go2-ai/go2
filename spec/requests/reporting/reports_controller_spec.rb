require "rails_helper"

RSpec.describe "Reporting reports", type: :request do
  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let!(:member) { create(:member, organization: organization, user: user) }
  let!(:year) { create(:fiscal_year, organization: organization, start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31)) }
  let(:base_path) { "/organizations/#{organization.id}/reporting/reports" }

  let(:center_type) { create(:accounting_center_type, organization: organization, first_code: "000001", last_code: "000050") }
  let(:customer_a) { create(:accounting_center, center_type: center_type, code: "000001") }
  let(:customer_b) { create(:accounting_center, center_type: center_type, code: "000002") }
  let(:bank) { create_account_in(organization, "CA", ledger_code: "10", name: "Bank") }
  let(:receivables) { create_account_in(organization, "CA", ledger_code: "11", name: "Receivables") }
  let(:revenue) { create_account_in(organization, "RE", ledger_code: "10", name: "Sales") }

  let(:bs) { Reporting::Report.system.find_by!(key: "ifrs.balance_sheet") }
  let(:pl) { Reporting::Report.system.find_by!(key: "ifrs.income_statement") }

  def grant(report, grantee, access: :view)
    Reporting::ReportGrant.create!(organization: organization, report: report, grantee: grantee, access: access)
  end

  before do
    Accounting::Statements::Presets::Loader.call
    post_entry(fiscal_year: year, date: Date.new(2024, 2, 1), lines: [
      je_line(receivables, debit: 100, centers: { 1 => customer_a }),
      je_line(receivables, debit: 50, centers: { 1 => customer_b }),
      je_line(revenue, credit: 150)
    ])
    post_entry(fiscal_year: year, date: Date.new(2024, 3, 1), lines: [ je_line(bank, debit: 150), je_line(receivables, credit: 150) ])
    sign_in(user)
  end

  context "with a report grant only" do
    let(:role) { create(:role, organization: organization, member: member) }

    before { grant(bs, role) }

    it "lists and runs the granted report, nothing else" do
      get base_path, as: :json
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.map { |r| r["key"] }).to eq([ "ifrs.balance_sheet" ])
      expect(response.parsed_body.first["permissions"]).to include("can_view" => true, "can_edit" => false,
                                                                   "can_drill_to_entries" => false)

      get "#{base_path}/#{bs.id}/run", params: { date: "2024-12-31" }, as: :json
      expect(response).to have_http_status(:ok)
      lines = response.parsed_body["lines"].index_by { |l| l["key"] }
      expect(lines.dig("total_assets", "values", "current")).to eq("150.0")
      expect(lines.dig("total_equity_and_liabilities", "values", "current")).to eq("150.0")

      get "#{base_path}/#{pl.id}/run", as: :json
      expect(response).to have_http_status(:forbidden)
      get "#{base_path}/#{pl.id}", as: :json
      expect(response).to have_http_status(:forbidden)
    end

    it "drills a line down to accounts and centers, only within that line" do
      get "#{base_path}/#{bs.id}/drill", params: { date: "2024-12-31", line: "other_current_assets" }, as: :json
      expect(response).to have_http_status(:ok)
      rows = response.parsed_body["rows"]
      expect(rows.map { |r| r["account_name"] }).to eq([ "Bank" ])
      # Bank has no centers: nothing to break down.
      expect(rows.first["center_levels"]).to eq([])
      expect(response.parsed_body).not_to have_key("center_levels")

      receivable_rule = Accounting::StatementMappingRule.create!(
        layout: bs.statement_layout, line: bs.statement_layout.lines.find_by!(key: "trade_and_other_receivables"),
        selector_type: :ledger, selector: { "ids" => [ receivables.ledger_id ] }
      )
      post_entry(fiscal_year: year, date: Date.new(2024, 4, 1), lines: [
        je_line(receivables, debit: 40, centers: { 1 => customer_a }), je_line(revenue, credit: 40)
      ])
      get "#{base_path}/#{bs.id}/drill", params: { date: "2024-12-31", line: "trade_and_other_receivables",
                                                   account_id: receivables.id, center_level: 1 }, as: :json
      rows = response.parsed_body["rows"]
      expect(rows.map { |r| [ r["center_code"], r["values"]["current"] ] })
        .to eq([ [ nil, "-150.0" ], [ "000001", "140.0" ], [ "000002", "50.0" ] ])
      expect(rows.first["rule_ids"]).to eq([ receivable_rule.id ])

      get "#{base_path}/#{bs.id}/drill", params: { date: "2024-12-31", line: "trade_and_other_receivables" }, as: :json
      expect(response.parsed_body["rows"].map { |r| r["center_levels"] }).to eq([ [ 1 ] ])
    end
  end

  it "shows every report to journal entry readers, with drill-down to entries" do
    create(:permission, code: Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES, grantee: member, organization: organization)

    get base_path, as: :json
    expect(response.parsed_body.map { |r| r["key"] }).to contain_exactly("ifrs.balance_sheet", "ifrs.income_statement", "ifrs.cash_flow",
                                                                              "general.trial_balance", "general.financial_ratios")
    expect(response.parsed_body.first.dig("permissions", "can_drill_to_entries")).to be true

    get "#{base_path}/#{pl.id}/run", params: { from: "2024-01-01", to: "2024-12-31" }, as: :json
    lines = response.parsed_body["lines"].index_by { |l| l["key"] }
    expect(lines.dig("profit_for_the_year", "values", "current")).to eq("150.0")
    expect(response.parsed_body["columns"].map { |c| c["key"] }).to eq([ "current" ])
  end

  it "runs the trial balance" do
    create(:permission, code: Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES, grantee: member, organization: organization)
    tb = Reporting::Report.system.find_by!(key: "general.trial_balance")

    get "#{base_path}/#{tb.id}/run", params: { from: "2024-01-01", to: "2024-12-31", level: "account" }, as: :json
    expect(response).to have_http_status(:ok)
    body = response.parsed_body
    expect(body["rows"].map { |r| r["name"] }).to contain_exactly("Bank", "Receivables", "Sales")
    expect(body["totals"]).to include("debit" => "300.0", "credit" => "300.0")
    expect(body["entries"]["period"]).to include("from" => "2024-01-01")
  end

  it "hides everything from members without access" do
    get base_path, as: :json
    expect(response.parsed_body).to eq([])
    get "#{base_path}/#{bs.id}/run", as: :json
    expect(response).to have_http_status(:forbidden)
  end

  it "doesn't serve other organizations' reports" do
    other = Reporting::Reports::Copy.call(source: bs, organization: create(:organization))
    create(:permission, code: Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES, grantee: member, organization: organization)

    get "#{base_path}/#{other.id}/run", as: :json
    expect(response).to have_http_status(:not_found)
  end

  it "answers 422 for dates outside the fiscal years" do
    create(:permission, code: Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES, grantee: member, organization: organization)
    get "#{base_path}/#{bs.id}/run", params: { date: "2019-01-01" }, as: :json
    expect(response).to have_http_status(:unprocessable_content)
  end
end
