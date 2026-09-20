# frozen_string_literal: true

require "rails_helper"

RSpec.describe Accounting::ChartOfAccountsAi::Prompt do
  let(:organization) { create(:organization, locale: "en", active_locales: [ "fa" ]) }
  let(:member)       { create(:member, organization: organization) }
  let(:chat)         { create(:ai_chat, organization: organization, member: member, kind: "chart_of_accounts") }

  describe ".system_prompt" do
    subject(:prompt) { described_class.system_prompt(organization: organization) }

    it "is a String" do
      expect(prompt).to be_a(String)
    end

    it "describes the assistant role" do
      expect(prompt).to include("accounting assistant")
    end

    it "mentions the tool by name" do
      expect(prompt).to include("propose_chart_of_accounts")
    end

    it "embeds the ContextBuilder output" do
      expect(prompt).to include("## Context")
      expect(prompt).to include("## System Categories")
      expect(prompt).to include("## Accounting Settings")
    end
  end

  describe ".build_messages" do
    before do
      chat.append_message!(role: "user", content: "Hi, I run a bakery.", sender_member: member)
      chat.append_message!(role: "assistant", content: "Got it — where are you located?")
      chat.append_message!(role: "tool", content: "validation errors: code length")
    end

    subject(:messages) do
      described_class.build_messages(chat: chat, organization: organization)
    end

    it "starts with a system message" do
      expect(messages.first[:role]).to eq("system")
      expect(messages.first[:content]).to include("accounting assistant")
    end

    it "maps user messages to user role" do
      user_msg = messages.find { |m| m[:content] == "Hi, I run a bakery." }
      expect(user_msg[:role]).to eq("user")
    end

    it "maps assistant messages to assistant role" do
      assistant_msg = messages.find { |m| m[:content] == "Got it — where are you located?" }
      expect(assistant_msg[:role]).to eq("assistant")
    end

    it "flattens tool messages into user messages with a marker" do
      tool_msg = messages.find { |m| m[:content].include?("[Tool result]") }
      expect(tool_msg[:role]).to eq("user")
      expect(tool_msg[:content]).to include("validation errors: code length")
    end

    context "when the chat exceeds MAX_MESSAGES" do
      before do
        # Add enough messages to overflow
        (described_class::MAX_MESSAGES + 5).times do |i|
          chat.append_message!(role: "user", content: "msg #{i}", sender_member: member)
        end
      end

      it "keeps the system message at the front" do
        expect(messages.first[:role]).to eq("system")
      end

      it "keeps at most MAX_MESSAGES history messages" do
        # messages.length = 1 (system) + history
        expect(messages.length).to be <= described_class::MAX_MESSAGES + 1
      end

      it "keeps the most recent messages" do
        contents = messages.map { |m| m[:content] }
        expect(contents).to include("msg #{described_class::MAX_MESSAGES + 4}")
      end
    end

    context "when called without a chat" do
      it "raises ArgumentError" do
        expect {
          described_class.build_messages(chat: nil, organization: organization)
        }.to raise_error(ArgumentError, /chat is required/)
      end
    end
  end

  describe ".build_messages with an explicit system prompt" do
    it "overrides the default system prompt" do
      messages = described_class.build_messages(
        chat: chat, organization: organization, system: "Custom system."
      )
      expect(messages.first[:content]).to eq("Custom system.")
    end
  end
end
