require "rails_helper"

RSpec.describe "Statement mapping assistant", type: :request do
  include ActiveJob::TestHelper

  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let!(:member) { create(:member, organization: organization, user: user) }
  let!(:year) { create(:fiscal_year, organization: organization, start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31)) }
  let(:center_type) { create(:accounting_center_type, organization: organization, first_code: "000001", last_code: "000050") }
  let(:customer_a) { create(:accounting_center, center_type: center_type, code: "000001") }
  let(:customer_b) { create(:accounting_center, center_type: center_type, code: "000002") }
  let!(:receivables) { create_account_in(organization, "CA", ledger_code: "11", name: "Receivables") }
  let!(:revenue) { create_account_in(organization, "RE", ledger_code: "10", name: "Sales") }
  let(:report) { Reporting::Reports::Copy.call(source: Reporting::Report.system.find_by!(key: "ifrs.balance_sheet"), organization: organization) }
  let(:base) { "/organizations/#{organization.id}/accounting/statements/#{report.id}/mapping_chats" }

  let(:proposal) do
    {
      "summary" => "Receivables gross per customer",
      "changes" => [
        { "action" => "add", "line_key" => "trade_and_other_receivables", "selector_type" => "ledger",
          "selector" => { "ledger_codes" => [ "111" ] }, "opposite_line_key" => "contract_liabilities",
          "grain" => "account_center1", "reason" => "Customers in credit are advances", "confidence" => 0.9 },
        { "action" => "update", "rule_number" => 2, "priority" => 1, "reason" => "Keep as fallback", "confidence" => 0.5 }
      ]
    }
  end

  def response_with(name, arguments, id = "call_1")
    Ai::Response.new(content: "", tool_calls: [ { id: id, name: name, arguments: arguments } ])
  end

  def with_fake_ai(responses)
    adapter = Ai::Adapters::Fake.new(responses: responses)
    Ai::Client.with_adapter(adapter) { yield adapter }
  end

  before do
    Accounting::Statements::Presets::Loader.call
    create(:permission, code: Permission::REPORTS_MANAGE_STATEMENTS, grantee: member, organization: organization)
    post_entry(fiscal_year: year, date: Date.new(2024, 2, 1), lines: [
      je_line(receivables, debit: 100, centers: { 1 => customer_a }),
      je_line(receivables, credit: 30, centers: { 1 => customer_b }),
      je_line(revenue, credit: 70)
    ])
    sign_in(user)
  end

  it "looks the chart up, proposes, previews and applies selected changes" do
    post base, as: :json
    expect(response).to have_http_status(:ok)
    chat_id = response.parsed_body["id"]
    expect(AiChat.find(chat_id).subject).to eq(report)

    with_fake_ai([
      response_with("list_ledgers", {}),
      response_with("balance_signs", { "account_code" => "11101", "center_level" => 1 }, "call_2"),
      response_with("propose_mapping_rules", proposal, "call_3")
    ]) do |adapter|
      perform_enqueued_jobs do
        post "#{base}/#{chat_id}/messages", params: { content: "Map my receivables" }, as: :json
      end
      expect(adapter.lookup_results.map { |r| r[:name] }).to eq(%w[list_ledgers balance_signs])
      signs = adapter.lookup_results.last[:result]
      expect(signs).to include(centers_in_debit: 1, centers_in_credit: 1, credit_total: "-30.0")
      expect(adapter.calls.first[:system].to_s + adapter.calls.first[:messages].first[:content]).to include("trade_and_other_receivables")
    end

    chat = AiChat.find(chat_id)
    expect(chat.state).to include("valid" => true)

    get "#{base}/#{chat_id}/preview", params: { date: "2024-12-31", indexes: "0" }, as: :json
    expect(response).to have_http_status(:ok)
    rows = response.parsed_body["rows"].select { |r| r["account_name"] == "Receivables" }
    expect(rows.map { |r| r["proposed_line_key"] }).to contain_exactly("trade_and_other_receivables", "contract_liabilities")
    expect(rows.all? { |r| r["changed"] }).to be true

    post "#{base}/#{chat_id}/accept", params: { indexes: [ 0 ] }, as: :json
    expect(response).to have_http_status(:ok)
    rules = report.statement_layout.rules.reload
    added = rules.find { |r| r.selector_type == "ledger" }
    expect(added).to have_attributes(grain: "account_center1", selector: { "ids" => [ receivables.ledger_id ] },
                                     note: "Customers in credit are advances")
    expect(added.opposite_line.key).to eq("contract_liabilities")
    expect(rules.find { |r| r.selector["identifiers"] == [ "CA" ] }.priority).to be_nil # change 1 not applied
  end

  it "sends invalid proposals back to the model" do
    post base, as: :json
    chat_id = response.parsed_body["id"]
    bad = { "summary" => "x", "changes" => [ { "action" => "add", "line_key" => "assets", "selector_type" => "ledger",
                                               "selector" => { "ledger_codes" => [ "999" ] }, "reason" => "x", "confidence" => 1 } ] }
    with_fake_ai([ response_with("propose_mapping_rules", bad), response_with("propose_mapping_rules", proposal, "call_2") ]) do
      perform_enqueued_jobs { post "#{base}/#{chat_id}/messages", params: { content: "Map" }, as: :json }
    end
    chat = AiChat.find(chat_id)
    tool_message = chat.messages.find_by(role: "tool")
    expect(tool_message.content).to include("unknown codes 999")
    expect(chat.state["valid"]).to be true
  end

  describe Accounting::StatementMappingAi::Proposal do
    let(:layout) { report.statement_layout }

    it "accepts selector keys next to the selector and infers the selector type" do
      proposal = described_class.from({ "changes" => [
        { "action" => "add", "line_key" => "trade_and_other_receivables", "ledger_codes" => [ "111" ], "reason" => "x" }
      ] }, layout: layout)

      expect(proposal.errors).to be_empty
      expect(proposal.merged_entries.last).to include("selector_type" => "ledger", "selector" => { "ids" => [ receivables.ledger_id ] })
    end

    it "explains an empty selector on the change, not on the merged rule list" do
      proposal = described_class.from({ "changes" => [
        { "action" => "add", "line_key" => "trade_and_other_receivables", "selector_type" => "ledger" }
      ] }, layout: layout)

      expect(proposal.errors.map(&:to_h)).to eq([ { path: "changes[0]", field: "selector.ledger_codes",
                                                    message: "is required (inside selector)" } ])
    end
  end

  it "requires the statements permission and an organization report" do
    Permission.where(grantee: member).delete_all
    post base, as: :json
    expect(response).to have_http_status(:forbidden)

    create(:permission, code: Permission::REPORTS_MANAGE_STATEMENTS, grantee: member, organization: organization)
    system = Reporting::Report.system.find_by!(key: "ifrs.balance_sheet")
    post "/organizations/#{organization.id}/accounting/statements/#{system.id}/mapping_chats", as: :json
    expect(response).to have_http_status(:forbidden)
  end
end
