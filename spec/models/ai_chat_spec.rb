# frozen_string_literal: true

require "rails_helper"

RSpec.describe AiChat, type: :model do
  let(:organization) { create(:organization) }
  let(:member)       { create(:member, organization: organization) }

  describe "associations" do
    it { should belong_to(:organization) }
    it { should belong_to(:member) }
    it { should have_many(:messages).dependent(:destroy) }
    it { should have_many(:documents).dependent(:destroy) }
  end

  describe "validations" do
    it "requires kind to be in KINDS" do
      chat = build(:ai_chat, organization: organization, member: member, kind: "nonsense")
      expect(chat).not_to be_valid
      expect(chat.errors[:kind]).to be_present
    end

    it "requires status to be in STATUSES" do
      chat = build(:ai_chat, organization: organization, member: member, status: "pending")
      expect(chat).not_to be_valid
      expect(chat.errors[:status]).to be_present
    end

    it "is valid with default attributes" do
      expect(build(:ai_chat, organization: organization, member: member)).to be_valid
    end
  end

  describe "scopes" do
    let!(:open_chat)     { create(:ai_chat, organization: organization, member: member, status: "open") }
    let!(:accepted_chat) { create(:ai_chat, organization: organization, member: member, status: "accepted") }

    it ".open returns only open chats" do
      expect(described_class.open).to contain_exactly(open_chat)
    end

    it ".for_kind filters by kind" do
      expect(described_class.for_kind("chart_of_accounts")).to contain_exactly(open_chat, accepted_chat)
    end
  end

  describe "#append_message!" do
    let(:chat) { create(:ai_chat, organization: organization, member: member) }

    it "creates a message and bumps last_message_at" do
      expect {
        chat.append_message!(role: "user", content: "hello", sender_member: member)
      }.to change { chat.messages.count }.by(1)

      expect(chat.reload.last_message_at).to be_within(2.seconds).of(Time.current)
    end

    it "creates assistant messages with no sender" do
      chat.append_message!(role: "assistant", content: "hi")
      msg = chat.messages.last
      expect(msg.role).to eq("assistant")
      expect(msg.sender_member).to be_nil
    end
  end

  describe "#accept! / #abandon!" do
    let(:chat) { create(:ai_chat, organization: organization, member: member) }

    it "accept! sets status to accepted" do
      chat.accept!
      expect(chat.reload.status).to eq("accepted")
    end

    it "abandon! sets status to abandoned and stamps abandoned_at" do
      chat.abandon!
      expect(chat.reload.status).to eq("abandoned")
      expect(chat.abandoned_at).to be_present
    end
  end
end
