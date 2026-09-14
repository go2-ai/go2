# frozen_string_literal: true

class AiChatBlueprint < Blueprinter::Base
  identifier :id

  fields :kind, :status, :last_message_at, :created_at, :updated_at

  field :state do |chat|
    chat.state || {}
  end

  view :with_messages do
    association :messages,
                blueprint: AiMessageBlueprint,
                name: :messages do |chat|
      # Always return the full chronological history. Chats are small
      # (dozens of messages at most in normal use) and the frontend
      # benefits from having the whole transcript available for
      # scrollback.
      chat.messages.chronological
    end
  end
end
