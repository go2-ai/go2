require "rails_helper"

RSpec.describe "Reporting prints", type: :request do
  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let!(:member) { create(:member, organization: organization, user: user) }
  let!(:year) { create(:fiscal_year, organization: organization, start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31)) }
  let(:bank) { create_account_in(organization, "CA", ledger_code: "10", name: "Bank") }
  let(:revenue) { create_account_in(organization, "RE", ledger_code: "10", name: "Sales") }
  let(:base) { "/organizations/#{organization.id}/reporting/reports" }

  def system(key) = Reporting::Report.system.find_by!(key: key)

  before do
    Accounting::Statements::Presets::Loader.call
    post_entry(fiscal_year: year, date: Date.new(2024, 2, 1), lines: [ je_line(bank, debit: 100), je_line(revenue, credit: 100) ])
    sign_in(user)
  end

  describe "templates" do
    {
      Accounting::Reports::FinancialStatementTemplate => "financial_statement",
      Accounting::Reports::TrialBalanceTemplate => "trial_balance",
      Accounting::Reports::FinancialRatiosTemplate => "financial_ratios"
    }.each do |generator, key|
      it "builds the #{key} template in English and mirrored Persian" do
        en = generator.build(locale: "en")
        fa = generator.build(locale: "fa")
        expect(generator::REPORT_KEY).to eq(key)
        expect(en.dig("dataSources", 2, "path")).to eq("root.rows")
        lines = ->(t) { t["body"].find { |b| b["id"] == "lines" } }
        first_cell = ->(t) { lines.call(t).dig("detail", "components").first }
        expect(first_cell.call(en)["x"]).to eq(0)
        expect(first_cell.call(fa)["x"]).to be > 0
        expect(fa.dig("styles", "cell", "fontFamily")).to include("Yekan")
      end
    end

    it "hides the comparison columns when there is none" do
      region = Accounting::Reports::FinancialStatementTemplate.build(locale: "en")["body"].find { |b| b["id"] == "lines" }
      previous = region.dig("detail", "components").find { |c| c["id"] == "td_previous" }
      expect(previous["visible"]).to eq("summary[0].comparison")
    end
  end

  it "serves print data in the template's language, for viewers of the report only" do
    bs = system("ifrs.balance_sheet")
    Reporting::ReportGrant.create!(organization: organization, report: bs, grantee: member)

    get "#{base}/#{bs.id}/run", params: { view: "print", locale: "fa", date: "2024-12-31", comparison: false }, as: :json
    expect(response).to have_http_status(:ok)
    body = response.parsed_body
    expect(body).to include("comparison" => false, "report_name" => "صورت وضعیت مالی (IFRS)")
    row = body["rows"].find { |r| r["label"] == "سایر دارایی‌های جاری" }
    expect(row).to include("current" => 100.0, "depth" => 2)
    expect(row["indented_label"]).to start_with("\u00A0")
    expect(body["rows"].map { |r| r["label"] }).not_to include(nil)

    get "#{base}/#{system('general.trial_balance').id}/run", params: { view: "print" }, as: :json
    expect(response).to have_http_status(:forbidden)
  end

  it "prints the trial balance and the ratios" do
    create(:permission, code: Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES, grantee: member, organization: organization)

    get "#{base}/#{system('general.trial_balance').id}/run",
        params: { view: "print", locale: "en", from: "2024-01-01", to: "2024-12-31", level: "account" }, as: :json
    body = response.parsed_body
    expect(body).to include("level_name" => "Account", "total_debit" => 100.0, "total_credit" => 100.0)
    expect(body["rows"].map { |r| r["name"] }).to contain_exactly("Bank", "Sales")

    get "#{base}/#{system('general.financial_ratios').id}/run",
        params: { view: "print", locale: "en", from: "2024-01-01", to: "2024-12-31" }, as: :json
    ratios = response.parsed_body["rows"].index_by { |r| r["name"] }
    expect(ratios["Net margin"]).to include("current" => "100.0%", "group_name" => "Profitability")
    expect(ratios["Current ratio"]["current"]).to eq("n/a")
  end

  it "lets every member see the reporting print templates" do
    expect(ReportRegistry.access(user, organization).can_print?("financial_statement")).to be true
    expect(ReportRegistry.access(user, organization).can_manage?("financial_statement")).to be false
  end
end
