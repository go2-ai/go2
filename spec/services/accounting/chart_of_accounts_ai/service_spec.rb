# frozen_string_literal: true

require "rails_helper"

RSpec.describe Accounting::ChartOfAccountsAi::Service do
  let(:organization) { create(:organization, locale: "en", active_locales: [ "fa" ]) }
  let(:member)       { create(:member, organization: organization) }
  let(:chat) do
    create(:ai_chat, organization: organization, member: member, kind: "chart_of_accounts")
  end

  # ── Fixtures ────────────────────────────────────────────────────────────

  def valid_proposal_hash
    {
      "categories" => [],
      "ledgers" => [
        {
          "category" => "CA",
          "code" => "10",
          "name" => { "en" => "Cash", "fa" => "نقد" },
          "unexpected_balance" => "accept",
          "is_monetary" => true
        }
      ],
      "accounts" => [
        {
          "ledger" => "CA.10",
          "code" => "01",
          "name" => { "en" => "Petty Cash", "fa" => "تنخواه" },
          "accepts_other_currencies" => false
        }
      ]
    }
  end

  # A proposal that fails validation on the is_monetary rule — RE cannot
  # be monetary — so the AI is forced to correct it.
  def invalid_proposal_hash
    {
      "categories" => [],
      "ledgers" => [
        {
          "category" => "RE",
          "code" => "10",
          "name" => { "en" => "Revenue" },
          "unexpected_balance" => "accept",
          "is_monetary" => true
        }
      ],
      "accounts" => [
        {
          "ledger" => "RE.10",
          "code" => "01",
          "name" => { "en" => "Sales" },
          "accepts_other_currencies" => false
        }
      ]
    }
  end

  def tool_call_response(arguments, content: nil)
    Ai::Response.new(
      content: content.to_s,
      tool_calls: [ { id: "call_x", name: "propose_chart_of_accounts", arguments: arguments } ]
    )
  end

  def text_response(content)
    Ai::Response.new(content: content)
  end

  def run_service(responses:, content: "I run a bakery")
    adapter = Ai::Adapters::Fake.new(responses: responses)
    result = nil
    Ai::Client.with_adapter(adapter) do
      result = described_class.call(chat: chat, user_content: content)
    end
    result
  end

  # ── NOT_CONFIGURED fast path ────────────────────────────────────────────

  describe "when AI is not configured" do
    before do
      allow(Ai::Client).to receive(:available?).and_return(false)
    end

    it "returns NOT_CONFIGURED without persisting anything" do
      expect {
        result = described_class.call(chat: chat, user_content: "hi")
        expect(result.status).to eq(Accounting::ChartOfAccountsAi::Result::NOT_CONFIGURED)
      }.not_to change { chat.messages.count }
    end
  end

  # ── Plain text reply ────────────────────────────────────────────────────

  describe "when the assistant replies with plain text" do
    it "persists the user message and the assistant message and returns AWAITING_INPUT" do
      result = run_service(responses: [ text_response("What industry?") ])

      expect(result.status).to eq(:awaiting_input)
      expect(result.retry_count).to eq(0)
      expect(result.messages_created.length).to eq(2)

      chat.reload
      expect(chat.messages.where(role: "user").last.content).to eq("I run a bakery")
      expect(chat.messages.where(role: "assistant").last.content).to eq("What industry?")
    end

    it "does not touch chat.state" do
      expect {
        run_service(responses: [ text_response("What industry?") ])
      }.not_to change { chat.reload.state }
    end
  end

  # ── Valid proposal on the first try ─────────────────────────────────────

  describe "when the assistant produces a valid proposal immediately" do
    it "returns PROPOSAL_READY with valid: true" do
      result = run_service(responses: [ tool_call_response(valid_proposal_hash) ])

      expect(result.status).to eq(:proposal_ready)
      expect(result.valid).to be true
      expect(result.errors).to eq([])
      expect(result.retry_count).to eq(0)
      expect(result.proposal).to be_a(Accounting::ChartOfAccountsProposal)
    end

    it "persists a fallback success summary when the response has no text" do
      run_service(responses: [ tool_call_response(valid_proposal_hash) ])

      assistant_msg = chat.reload.messages.where(role: "assistant").last
      expect(assistant_msg.content).to include("I've prepared a chart of accounts")
      expect(assistant_msg.content).to include("1 ledger")
      expect(assistant_msg.content).to include("1 account")
    end

    it "uses the assistant text when present instead of the fallback summary" do
      run_service(responses: [ tool_call_response(valid_proposal_hash, content: "Here you go!") ])

      assistant_msg = chat.reload.messages.where(role: "assistant").last
      expect(assistant_msg.content).to eq("Here you go!")
    end

    it "stores the raw proposal and valid: true in chat.state" do
      run_service(responses: [ tool_call_response(valid_proposal_hash) ])

      state = chat.reload.state
      expect(state["valid"]).to be true
      expect(state["errors"]).to eq([])
      expect(state["latest_proposal"]).to eq(valid_proposal_hash)
      expect(state["last_updated_at"]).to be_present
    end
  end

  # ── Invalid proposal, then valid on retry ───────────────────────────────

  describe "when the assistant first produces an invalid proposal" do
    it "persists a tool error message, retries, and returns PROPOSAL_READY" do
      result = run_service(responses: [
        tool_call_response(invalid_proposal_hash),
        tool_call_response(valid_proposal_hash)
      ])

      expect(result.status).to eq(:proposal_ready)
      expect(result.valid).to be true
      expect(result.retry_count).to eq(1)
    end

    it "records the failed attempt as a tool message before the correction" do
      run_service(responses: [
        tool_call_response(invalid_proposal_hash),
        tool_call_response(valid_proposal_hash)
      ])

      roles = chat.reload.messages.chronological.map(&:role)
      expect(roles).to eq(%w[user tool assistant])
    end
  end

  # ── Retries exhausted ───────────────────────────────────────────────────

  describe "when the assistant keeps producing invalid proposals" do
    it "returns RETRIES_EXHAUSTED after MAX_ATTEMPTS" do
      result = run_service(responses: [
        tool_call_response(invalid_proposal_hash),
        tool_call_response(invalid_proposal_hash),
        tool_call_response(invalid_proposal_hash)
      ])

      expect(result.status).to eq(:retries_exhausted)
      expect(result.valid).to be false
      expect(result.retry_count).to eq(2)
      expect(result.errors).not_to be_empty
    end

    it "persists a final assistant nudge listing the errors and offering catalogs" do
      run_service(responses: [
        tool_call_response(invalid_proposal_hash),
        tool_call_response(invalid_proposal_hash),
        tool_call_response(invalid_proposal_hash)
      ])

      final = chat.reload.messages.where(role: "assistant").last
      expect(final.content).to include("I wasn't able to produce a valid chart of accounts")
      expect(final.content).to include("service_company")
    end

    it "leaves the last invalid proposal in chat.state with valid: false" do
      run_service(responses: [
        tool_call_response(invalid_proposal_hash),
        tool_call_response(invalid_proposal_hash),
        tool_call_response(invalid_proposal_hash)
      ])

      state = chat.reload.state
      expect(state["valid"]).to be false
      expect(state["errors"]).not_to be_empty
      expect(state["errors"].first["field"]).to eq("is_monetary")
    end
  end

  # ── Retryable provider errors ───────────────────────────────────────────

  # ── Retryable provider errors ───────────────────────────────────────────

  describe "when the provider raises a retryable error" do
    it "retries on RateLimitError and sleeps once, then succeeds" do
      sleep_calls = []
      allow_any_instance_of(described_class).to receive(:sleep) { |_, s| sleep_calls << s }

      result = run_service(responses: [
        Ai::RateLimitError.new("Slow down"),
        tool_call_response(valid_proposal_hash)
      ])

      expect(result.status).to eq(:proposal_ready)
      expect(result.retry_count).to eq(1)
      expect(sleep_calls).to eq([ 1 ])

      roles = chat.reload.messages.chronological.map(&:role)
      expect(roles).to eq(%w[user tool assistant])
    end

    it "does not sleep on a NetworkError retry" do
      sleep_calls = []
      allow_any_instance_of(described_class).to receive(:sleep) { |_, s| sleep_calls << s }

      result = run_service(responses: [
        Ai::NetworkError.new("Timeout"),
        tool_call_response(valid_proposal_hash)
      ])

      expect(result.status).to eq(:proposal_ready)
      expect(sleep_calls).to eq([])
    end

    it "returns PROVIDER_ERROR after exhausting attempts on persistent 5xx" do
      result = run_service(responses: [
        Ai::ServerError.new("Boom"),
        Ai::ServerError.new("Boom"),
        Ai::ServerError.new("Boom")
      ])

      expect(result.status).to eq(:provider_error)
      expect(result.provider_error_message).to eq("Boom")
      expect(result.retry_count).to eq(2)
    end
  end

  # ── Non-retryable provider errors ───────────────────────────────────────

  describe "when the provider raises a non-retryable error" do
    it "returns PROVIDER_ERROR immediately without retrying" do
      result = run_service(responses: [ Ai::AuthenticationError.new("Bad key") ])

      expect(result.status).to eq(:provider_error)
      expect(result.provider_error_message).to eq("Bad key")
      expect(result.retry_count).to eq(0)
    end

    it "still persists the user message and the provider error as a tool message" do
      run_service(responses: [ Ai::ClientError.new("Bad model") ])

      roles = chat.reload.messages.chronological.map(&:role)
      expect(roles).to eq(%w[user tool])
      tool_msg = chat.messages.where(role: "tool").last
      expect(tool_msg.content).to include("ClientError")
      expect(tool_msg.content).to include("Bad model")
    end
  end

  # ── Tool call for an unknown tool ───────────────────────────────────────

  describe "when the assistant calls a different tool" do
    it "treats it as a plain text reply" do
      response = Ai::Response.new(
        content: "Hmm, let me think.",
        tool_calls: [ { id: "x", name: "some_other_tool", arguments: {} } ]
      )

      result = run_service(responses: [ response ])

      expect(result.status).to eq(:awaiting_input)
      assistant_msg = chat.reload.messages.where(role: "assistant").last
      expect(assistant_msg.content).to eq("Hmm, let me think.")
    end
  end

  # ── Empty tool-call arguments ───────────────────────────────────────────

  describe "when the tool call has empty arguments" do
    it "treats the resulting proposal as invalid and enters the retry loop" do
      result = run_service(responses: [
        tool_call_response({}),
        tool_call_response({}),
        tool_call_response({})
      ])

      expect(result.status).to eq(:retries_exhausted)
      expect(result.errors).not_to be_empty
    end
  end
end
