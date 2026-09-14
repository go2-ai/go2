# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Accounting::ChartOfAccountsAi::Chats API", type: :request do
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

  def chats_path(organization_id = organization.id)
    "/organizations/#{organization_id}/accounting/chart_of_accounts_ai/chats"
  end

  def chat_path(id, organization_id = organization.id)
    "#{chats_path(organization_id)}/#{id}"
  end

  def messages_path(id, organization_id = organization.id)
    "#{chat_path(id, organization_id)}/messages"
  end

  def abandon_path(id, organization_id = organization.id)
    "#{chat_path(id, organization_id)}/abandon"
  end

  # ── POST /chats ─────────────────────────────────────────────────────────

  describe "POST /chats" do
    context "when the chart is empty and the org is not inheriting" do
      it "creates a new open chat and returns it" do
        expect {
          post chats_path, as: :json
        }.to change { AiChat.where(member: member, kind: "chart_of_accounts").count }.by(1)

        expect(response).to have_http_status(:ok)
        body = JSON.parse(response.body)
        expect(body["kind"]).to eq("chart_of_accounts")
        expect(body["status"]).to eq("open")
        expect(body["messages"]).to eq([])
      end

      it "returns the existing open chat if one already exists (idempotent)" do
        existing = create(:ai_chat,
                          organization: organization,
                          member: member,
                          kind: "chart_of_accounts",
                          status: "open")

        expect {
          post chats_path, as: :json
        }.not_to change { AiChat.count }

        body = JSON.parse(response.body)
        expect(body["id"]).to eq(existing.id)
      end

      it "returns 403 if the org inherits its parent's chart" do
        organization.accounting_setting.update!(use_parent_org_accounts: true)

        post chats_path, as: :json
        expect(response).to have_http_status(:forbidden)
      end

      it "returns 403 if the org already has ledgers" do
        category = organization.account_categories.find_by!(identifier: "CA")
        create(:accounting_ledger, account_category: category, code: "10")

        post chats_path, as: :json
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when the user is not an org admin" do
      let(:non_admin) { create(:member, organization: organization) }
      let(:other_user) { create(:user) }

      before do
        non_admin.update!(user: other_user)
        sign_in other_user
      end

      it "returns 403" do
        post chats_path, as: :json
        expect(response).to have_http_status(:forbidden)
      end
    end
  end

  # ── GET /chats/:id ──────────────────────────────────────────────────────

  describe "GET /chats/:id" do
    let!(:chat) do
      create(:ai_chat, :with_messages,
             organization: organization,
             member: member,
             kind: "chart_of_accounts")
    end

    it "returns the chat with its full message history" do
      get chat_path(chat.id), as: :json

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["id"]).to eq(chat.id)
      expect(body["messages"]).to be_an(Array)
      expect(body["messages"].length).to be > 0
    end

    it "returns 404 for a chat belonging to another member" do
      other_member = create(:member, organization: organization)
      other_chat = create(:ai_chat,
                          organization: organization,
                          member: other_member,
                          kind: "chart_of_accounts")

      get chat_path(other_chat.id), as: :json
      expect(response).to have_http_status(:not_found)
    end
  end

  # ── POST /chats/:id/messages ────────────────────────────────────────────
  #
  # Since Step 6C this endpoint is asynchronous: it persists the user
  # message, enqueues ProcessMessageJob, and returns 202 Accepted. The
  # client is expected to poll GET /chats/:id until chat.state["processing"]
  # is false.
  #
  # For the synchronous end-to-end test, see
  # chats_controller_messages_inline_spec.rb.

  describe "POST /chats/:id/messages" do
    let!(:chat) do
      create(:ai_chat,
             organization: organization,
             member: member,
             kind: "chart_of_accounts")
    end

    it "returns 422 when content is blank" do
      post messages_path(chat.id), params: { content: "  " }, as: :json
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "persists the user message, enqueues the job, and returns 202" do
      expect {
        post messages_path(chat.id), params: { content: "I run a bakery" }, as: :json
      }.to have_enqueued_job(Accounting::ChartOfAccountsAi::ProcessMessageJob)

      expect(response).to have_http_status(:accepted)
      body = JSON.parse(response.body)
      expect(body["status"]).to eq("processing")
      expect(body["user_message_id"]).to be_present

      # The user message was persisted immediately
      user_msg = chat.reload.messages.where(role: "user").last
      expect(user_msg.content).to eq("I run a bakery")
    end

    it "ignores attachment_ids that don't belong to this chat" do
      other_member = create(:member, organization: organization)
      other_chat = create(:ai_chat,
                          organization: organization,
                          member: other_member,
                          kind: "chart_of_accounts")

      foreign_document = Document.new(
        organization: organization,
        documentable: other_chat,
        member: other_member
      )
      foreign_document.attachment.attach(
        io: StringIO.new("foreign file"),
        filename: "other.txt",
        content_type: "text/plain"
      )
      foreign_document.save!

      post messages_path(chat.id),
           params: { content: "hi", attachment_ids: [ foreign_document.id ] },
           as: :json

      expect(response).to have_http_status(:accepted)

      # The foreign document must NOT have been moved.
      foreign_document.reload
      expect(foreign_document.documentable_type).to eq("AiChat")
      expect(foreign_document.documentable_id).to eq(other_chat.id)
    end

    it "returns 409 if the chat is already processing" do
      chat.update!(state: chat.state.merge("processing" => true))

      post messages_path(chat.id), params: { content: "hi" }, as: :json
      expect(response).to have_http_status(:conflict)
    end

    it "does not run the AI synchronously" do
      # If the service were called in the request, this would raise
      # (Null adapter would be used, but the request would still take
      # the service's path). Instead, the request must be fast and
      # must not have created any assistant messages.
      post messages_path(chat.id), params: { content: "hi" }, as: :json

      expect(chat.reload.messages.where(role: "assistant").count).to eq(0)
    end
  end

  # ── POST /chats/:id/abandon ─────────────────────────────────────────────

  describe "POST /chats/:id/abandon" do
    let!(:chat) do
      create(:ai_chat,
             organization: organization,
             member: member,
             kind: "chart_of_accounts")
    end

    it "marks the chat as abandoned and returns it" do
      post abandon_path(chat.id), as: :json

      expect(response).to have_http_status(:ok)
      body = JSON.parse(response.body)
      expect(body["status"]).to eq("abandoned")
      expect(chat.reload.status).to eq("abandoned")
      expect(chat.abandoned_at).to be_present
    end
  end
end
