# frozen_string_literal: true

require "rails_helper"

RSpec.describe Accounting::ChartOfAccountsAi::ProcessMessageJob do
  include ActiveJob::TestHelper

  let(:organization) { create(:organization, locale: "en", active_locales: [ "fa" ]) }
  let(:member)       { create(:member, organization: organization) }
  let(:chat) do
    create(:ai_chat,
           organization: organization,
           member: member,
           kind: "chart_of_accounts")
  end
  let!(:user_message) do
    chat.append_message!(role: "user", content: "I run a bakery", sender_member: member)
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

  def with_fake_ai(responses:, &block)
    adapter = Ai::Adapters::Fake.new(responses: responses)
    Ai::Client.with_adapter(adapter, &block)
  end

  describe "#perform" do
    it "marks the chat as processing at the start and clears it at the end" do
      with_fake_ai(responses: [ Ai::Response.new(content: "What industry?") ]) do
        described_class.perform_now(chat.id, user_message.id)
      end

      chat.reload
      expect(chat.state["processing"]).to be false
      expect(chat.state["processing_started_at"]).to be_present
      expect(chat.state["processing_finished_at"]).to be_present
    end

    it "runs the service and persists the assistant reply" do
      with_fake_ai(responses: [ Ai::Response.new(content: "What industry?") ]) do
        described_class.perform_now(chat.id, user_message.id)
      end

      assistant = chat.reload.messages.where(role: "assistant").last
      expect(assistant.content).to eq("What industry?")
    end

    it "persists a proposal when the AI produces one" do
      with_fake_ai(responses: [ tool_call_response(valid_proposal_hash) ]) do
        described_class.perform_now(chat.id, user_message.id)
      end

      expect(chat.reload.state["valid"]).to be true
      expect(chat.state["latest_proposal"]).to eq(valid_proposal_hash)
    end

    describe "when the service raises" do
      before do
        allow(Accounting::ChartOfAccountsAi::Service)
          .to receive(:call)
          .and_raise(Ai::AuthenticationError, "Bad key")
      end

      it "writes a fallback assistant message" do
        expect {
          begin
            described_class.perform_now(chat.id, user_message.id)
          rescue Ai::AuthenticationError
            # expected
          end
        }.to change { chat.messages.where(role: "assistant").count }.by(1)

        fallback = chat.messages.where(role: "assistant").last
        expect(fallback.content).to match(/couldn't complete/)
        expect(fallback.metadata["error"]).to be true
        expect(fallback.metadata["error_class"]).to eq("Ai::AuthenticationError")
      end

      it "still clears the processing flag" do
        begin
          described_class.perform_now(chat.id, user_message.id)
        rescue Ai::AuthenticationError
          # expected
        end

        expect(chat.reload.state["processing"]).to be false
      end

      it "re-raises so Solid Queue records the failure" do
        expect {
          described_class.perform_now(chat.id, user_message.id)
        }.to raise_error(Ai::AuthenticationError)
      end
    end
  end
end
