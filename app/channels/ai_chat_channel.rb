# frozen_string_literal: true

# Streams a lightweight "chat changed" signal to clients watching a
# specific AI chat. The socket does NOT carry chat data — it's a
# doorbell. On every signal the client refetches GET /chats/:id via RTK
# Query, which stays the single source of truth.
#
# Subscription is authorized by the same ownership rule the HTTP layer
# uses: the chat must belong to the current member in the given org.
class AiChatChannel < ApplicationCable::Channel
  def self.signal(chat, reason:)
    broadcast_to(
      chat,
      event:   "chat_changed",
      chat_id: chat.id,
      reason:  reason.to_s
    )
  end

  def subscribed
    member = current_user&.members&.find_by(organization_id: params[:organization_id])
    chat   = member&.ai_chats&.find_by(id: params[:chat_id])

    reject and return unless chat

    @chat = chat
    stream_for chat
  end

  private

  attr_reader :chat
end