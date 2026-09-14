# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Accounting::ChartOfAccountsAi::Chats messages (inline)", type: :request do
  include ActiveJob::TestHelper

  let(:organization) { create(:organization, locale: "en", active_locales: [ "fa" ]) }
  let(:user)         { create(:user) }
  let(:member)       { create(:member, organization: organization, user: user) }
  let(:permission) do
    create(:permission,
           code: Permission::ORG_ADMIN,
           grantee: member,
           organization: organization)
  end

  before do
    permission
    sign_in user
  end

  def messages_path(chat_id)
    "/organizations/#{organization.id}/accounting/chart_of_accounts_ai/chats/#{chat_id}/messages"
  end

  def valid_proposal_hash
    {
      "categories" => [],
      "ledgers" => [
        {
          "category" => "CA", "code" => "10",
          "name" => { "en" => "Cash" },
          "unexpected_balance" => "accept", "is_monetary" => true
        }
      ],
      "accounts" => [
        { "ledger" => "CA.10", "code" => "01", "name" => { "en" => "Petty Cash" } }
      ]
    }
  end

  def tool_call_response(arguments)
    Ai::Response.new(
      content: "",
      tool_calls: [ { id: "call_x", name: "propose_chart_of_accounts", arguments: arguments } ]
    )
  end

  def text_response(content)
    Ai::Response.new(content: content)
  end

  def with_fake_ai(responses:, &block)
    adapter = Ai::Adapters::Fake.new(responses: responses)
    Ai::Client.with_adapter(adapter, &block)
  end

  let!(:chat) do
    create(:ai_chat,
           organization: organization,
           member: member,
           kind: "chart_of_accounts")
  end

  it "runs the job inline and persists the assistant's reply" do
    with_fake_ai(responses: [ text_response("What industry?") ]) do
      perform_enqueued_jobs do
        post messages_path(chat.id), params: { content: "I run a bakery" }, as: :json
      end
    end

    expect(response).to have_http_status(:accepted)

    chat.reload
    expect(chat.messages.where(role: "user").last.content).to eq("I run a bakery")
    expect(chat.messages.where(role: "assistant").last.content).to eq("What industry?")
    expect(chat.state["processing"]).to be false
  end

  it "persists a proposal and marks valid in chat.state" do
    with_fake_ai(responses: [ tool_call_response(valid_proposal_hash) ]) do
      perform_enqueued_jobs do
        post messages_path(chat.id), params: { content: "I run a bakery" }, as: :json
      end
    end

    chat.reload
    expect(chat.state["valid"]).to be true
    expect(chat.state["latest_proposal"]).to eq(valid_proposal_hash)
  end
end
