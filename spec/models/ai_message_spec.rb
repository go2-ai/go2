# frozen_string_literal: true

require "rails_helper"

RSpec.describe AiMessage, type: :model do
  let(:chat) { create(:ai_chat) }

  describe "associations" do
    it { should belong_to(:ai_chat) }
    it { should belong_to(:sender_member).optional }
  end

  describe "validations" do
    it "requires role to be in ROLES" do
      msg = build(:ai_message, ai_chat: chat, role: "wizard")
      expect(msg).not_to be_valid
      expect(msg.errors[:role]).to be_present
    end

    it "allows a user message with a sender" do
      msg = build(:ai_message, ai_chat: chat, role: "user", sender_member: chat.member)
      expect(msg).to be_valid
    end

    it "rejects an assistant message with a sender" do
      msg = build(:ai_message, ai_chat: chat, role: "assistant", sender_member: chat.member)
      expect(msg).not_to be_valid
      expect(msg.errors[:sender_member]).to be_present
    end

    it "rejects a tool message with a sender" do
      msg = build(:ai_message, ai_chat: chat, role: "tool", sender_member: chat.member)
      expect(msg).not_to be_valid
    end
  end

  describe "scopes" do
    it ".chronological orders by created_at then id" do
      m1 = create(:ai_message, ai_chat: chat, created_at: 1.minute.ago)
      m2 = create(:ai_message, ai_chat: chat, created_at: 2.minutes.ago)
      expect(described_class.chronological.to_a).to eq([ m2, m1 ])
    end
  end

  describe "immutability" do
    it "does not have an updated_at column" do
      expect(described_class.column_names).not_to include("updated_at")
    end
  end
end
