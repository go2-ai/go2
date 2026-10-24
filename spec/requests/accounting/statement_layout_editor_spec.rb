require "rails_helper"

RSpec.describe "Statement layout editor", type: :request do
  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let!(:member) { create(:member, organization: organization, user: user) }
  let!(:year) { create(:fiscal_year, organization: organization, start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31)) }
  let(:center_type) { create(:accounting_center_type, organization: organization, first_code: "000001", last_code: "000050") }
  let(:customer_a) { create(:accounting_center, center_type: center_type, code: "000001") }
  let(:customer_b) { create(:accounting_center, center_type: center_type, code: "000002") }
  let(:bank) { create_account_in(organization, "CA", ledger_code: "10", name: "Bank") }
  let(:receivables) { create_account_in(organization, "CA", ledger_code: "11", name: "Receivables") }
  let(:revenue) { create_account_in(organization, "RE", ledger_code: "10", name: "Sales") }
  let(:expenses) { create_account_in(organization, "EX", ledger_code: "10", name: "General") }
  let(:tax) { create_account_in(organization, "EX", ledger_code: "10", account_code: "02", name: "Tax") }

  let(:bs) { Reporting::Reports::Copy.call(source: preset("ifrs.balance_sheet"), organization: organization) }
  let(:pl) { Reporting::Reports::Copy.call(source: preset("ifrs.income_statement"), organization: organization) }
  let(:layout) { bs.statement_layout }

  def preset(key) = Reporting::Report.system.find_by!(key: key)
  def path(report, suffix) = "/organizations/#{organization.id}/accounting/statements/#{report.id}/#{suffix}"
  def line(report, key) = report.statement_layout.lines.find_by!(key: key)

  before do
    Accounting::Statements::Presets::Loader.call
    create(:permission, code: Permission::REPORTS_MANAGE_STATEMENTS, grantee: member, organization: organization)
    post_entry(fiscal_year: year, date: Date.new(2024, 2, 1), lines: [
      je_line(receivables, debit: 100, centers: { 1 => customer_a }),
      je_line(receivables, credit: 30, centers: { 1 => customer_b }),
      je_line(revenue, credit: 70)
    ])
    post_entry(fiscal_year: year, date: Date.new(2024, 3, 1), lines: [
      je_line(expenses, debit: 20), je_line(tax, debit: 5), je_line(bank, credit: 25)
    ])
    sign_in(user)
  end

  it "returns the layout with the chart for the pickers" do
    get path(bs, "layout"), as: :json
    expect(response).to have_http_status(:ok)
    body = response.parsed_body
    expect(body["can_edit"]).to be true
    expect(body["lines"].map { |l| l["key"] }).to include("total_assets")
    expect(body["rules"].first).to include("number" => 1, "line_key" => "other_non_current_assets")
    expect(body.dig("chart", "accounts").map { |a| a["name"] }).to include("Receivables")
  end

  it "adds, changes, moves and deletes lines" do
    post path(bs, "lines"), params: { key: "loans_to_staff", parent_id: line(bs, "current_assets").id,
                                      normal_side: "debit", label: { en: "Loans to staff" } }, as: :json
    expect(response).to have_http_status(:created)
    created = layout.lines.find(response.parsed_body["line_id"])
    expect(created.label).to eq("Loans to staff")

    patch path(bs, "lines/#{created.id}"), params: { label: { en: "Staff loans" }, style: { bold: true } }, as: :json
    expect(created.reload).to have_attributes(label: "Staff loans", style: { "bold" => true })

    post path(bs, "lines/#{created.id}/move"), params: { parent_id: line(bs, "current_assets").id, index: 0 }, as: :json
    expect(line(bs, "current_assets").children.first).to eq(created)

    delete path(bs, "lines/#{created.id}"), as: :json
    expect(response).to have_http_status(:ok)
    expect(Accounting::StatementLine.exists?(created.id)).to be false
  end

  it "refuses to delete a line formulas use" do
    delete path(bs, "lines/#{line(bs, 'current_assets').id}"), as: :json
    expect(response).to have_http_status(:unprocessable_content)
    expect(response.parsed_body["errors"].first).to include("Total assets")
  end

  it "splits receivables per customer and shows it in the inspection list" do
    post path(bs, "rules"), params: {
      statement_line_id: line(bs, "trade_and_other_receivables").id,
      opposite_line_id: line(bs, "contract_liabilities").id,
      selector_type: "ledger", selector: { ids: [ receivables.ledger_id ] }, grain: "account_center1"
    }, as: :json
    expect(response).to have_http_status(:created)

    get path(bs, "inspection"), params: { date: "2024-12-31", comparison: false }, as: :json
    expect(response).to have_http_status(:ok)
    rows = response.parsed_body["rows"].select { |r| r["account_name"] == "Receivables" }
    by_center = rows.index_by { |r| r.dig("centers", 0, "code") }
    expect(by_center["000001"]).to include("line_key" => "trade_and_other_receivables", "reclassified" => false, "balance" => "100.0")
    expect(by_center["000002"]).to include("line_key" => "contract_liabilities", "reclassified" => true,
                                           "overridden_rule_numbers" => [ 2 ])
  end

  it "shows an account rule overriding a ledger rule (the tax example)" do
    post path(pl, "rules"), params: { statement_line_id: line(pl, "administrative_expenses").id,
                                      selector_type: "ledger", selector: { ids: [ expenses.ledger_id ] } }, as: :json
    post path(pl, "rules"), params: { statement_line_id: line(pl, "income_tax_expense").id,
                                      selector_type: "account", selector: { ids: [ tax.id ] } }, as: :json

    get path(pl, "inspection"), params: { from: "2024-01-01", to: "2024-12-31", comparison: false }, as: :json
    rows = response.parsed_body["rows"].index_by { |r| r["account_name"] }
    expect(rows["Tax"]).to include("line_key" => "income_tax_expense", "rule_number" => 4, "overridden_rule_numbers" => [ 3, 2 ])
    expect(rows["General"]).to include("line_key" => "administrative_expenses", "overridden_rule_numbers" => [ 2 ])
  end

  it "rejects a second rule equal in priority on the same balances" do
    params = { statement_line_id: line(pl, "administrative_expenses").id, selector_type: "ledger",
               selector: { ids: [ expenses.ledger_id ] } }
    post path(pl, "rules"), params: params, as: :json
    post path(pl, "rules"), params: params.merge(statement_line_id: line(pl, "distribution_costs").id), as: :json
    expect(response).to have_http_status(:unprocessable_content)

    post path(pl, "rules"), params: params.merge(statement_line_id: line(pl, "distribution_costs").id, priority: 5), as: :json
    expect(response).to have_http_status(:created)
  end

  it "previews proposed rules" do
    proposed = [ { line_key: "revenue", selector_type: "category", selector: { identifiers: [ "RE" ] } },
                 { line_key: "income_tax_expense", selector_type: "category", selector: { identifiers: [ "EX" ] } } ]
    get path(pl, "inspection"), params: { from: "2024-01-01", to: "2024-12-31", comparison: false,
                                          proposed_rules: proposed.to_json }, as: :json
    rows = response.parsed_body["rows"].index_by { |r| r["account_name"] }
    expect(rows["Tax"]).to include("line_key" => "other_expenses", "proposed_line_key" => "income_tax_expense", "changed" => true)
    expect(rows["Sales"]).to include("changed" => false)

    get path(pl, "inspection"), params: { proposed_rules: [ { line_key: "nope", selector_type: "ledger", selector: {} } ].to_json }, as: :json
    expect(response).to have_http_status(:unprocessable_content)
  end

  it "keeps system reports and report-only grantees read-only" do
    post path(preset("ifrs.balance_sheet"), "lines"), params: { key: "x", label: { en: "x" } }, as: :json
    expect(response).to have_http_status(:forbidden)

    Permission.where(grantee: member).delete_all
    Reporting::ReportGrant.create!(organization: organization, report: bs, grantee: member)
    get path(bs, "layout"), as: :json
    expect(response).to have_http_status(:ok)
    get path(bs, "inspection"), as: :json
    expect(response).to have_http_status(:forbidden)
  end
end
