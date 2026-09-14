# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Accounting::ChartOfAccountsAi::Chats accept", type: :request do
  let(:organization) { create(:organization, locale: "en", active_locales: [ "fa" ]) }
  let(:user)         { create(:user) }
  let(:member)       { create(:member, organization: organization, user: user) }

  before do
    create(:permission,
           code: Permission::ORG_ADMIN,
           grantee: member,
           organization: organization)
    sign_in user
  end

  def accept_path(chat_id)
    "/organizations/#{organization.id}/accounting/chart_of_accounts_ai/chats/#{chat_id}/accept"
  end

  def proposal_hash
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

  let!(:chat) do
    create(:ai_chat, organization: organization, member: member,
           kind: "chart_of_accounts", status: "open",
           state: { "latest_proposal" => proposal_hash })
  end

  it "persists the proposal and returns the chart and updated chat" do
    post accept_path(chat.id), as: :json

    expect(response).to have_http_status(:ok)
    body = JSON.parse(response.body)
    expect(body["chat"]["status"]).to eq("accepted")
    expect(body["chart"]).to be_an(Array)

    ca = body["chart"].find { |c| c["identifier"] == "CA" }
    expect(ca["ledgers"].first["code"]).to eq("10")
    expect(ca["ledgers"].first["accounts"].first["code"]).to eq("01")
  end

  it "returns 409 Conflict on a second accept" do
    chat.update!(status: "accepted")

    post accept_path(chat.id), as: :json
    expect(response).to have_http_status(:conflict)
  end

  it "returns 422 when the proposal fails re-validation" do
    chat.update!(state: { "latest_proposal" => { "categories" => [], "ledgers" => [], "accounts" => [] } })

    post accept_path(chat.id), as: :json
    expect(response).to have_http_status(:unprocessable_content)
    body = JSON.parse(response.body)
    expect(body["errors"]).not_to be_empty
    expect(chat.reload.status).to eq("open")
  end

  it "returns 404 for a chat belonging to another member" do
    other_member = create(:member, organization: organization)
    other_chat = create(:ai_chat,
                        organization: organization,
                        member: other_member,
                        kind: "chart_of_accounts")

    post accept_path(other_chat.id), as: :json
    expect(response).to have_http_status(:not_found)
  end
end
