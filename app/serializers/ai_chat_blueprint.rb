# frozen_string_literal: true

class AiChatBlueprint < Blueprinter::Base
  identifier :id

  fields :kind, :status, :last_message_at, :created_at, :updated_at

  field :state do |chat|
    chat.state || {}
  end

  # Always present, cheap to compute, useful for the client to know how
  # many total messages exist independent of the current view's message
  # payload. `nil` when the view doesn't include messages at all.
  field :messages_total do |chat, options|
    if options[:view] == :with_messages
      chat.messages.count
    end
  end

  # True when the payload only carries a slice of the full transcript.
  # False (or nil when messages aren't included) otherwise.
  field :messages_truncated do |chat, options|
    if options[:view] == :with_messages
      chat.messages.count > AiChat::MAX_PAYLOAD_MESSAGES
    end
  end

  view :with_messages do
    # Only the most recent MAX_PAYLOAD_MESSAGES, still in chronological
    # order so the client's render loop is unchanged. Older messages
    # remain in the DB; the client can request them later via a
    # dedicated paginated endpoint when that becomes necessary.
    association :messages,
                blueprint: AiMessageBlueprint,
                name: :messages do |chat|
      chat.messages
          .chronological
          .last(AiChat::MAX_PAYLOAD_MESSAGES)
    end
  end
end