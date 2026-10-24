# frozen_string_literal: true

module Ai
  # The messages sent to the model for a chat: the system prompt, then
  # the last `max` messages of the chat. Tool results are fed back as user
  # messages with a marker, so the model knows they came from its own tool
  # call. `override_last_user_content` replaces the last user message
  # (e.g. with the text of attached documents prepended).
  module PromptHistory
    MAX_MESSAGES = 30

    module_function

    def build(chat:, system:, override_last_user_content: nil, max: MAX_MESSAGES)
      messages = [ { role: "system", content: system } ]
      chat.messages.chronological.to_a.last(max).each { |message| messages << format(message) }
      if override_last_user_content.present?
        index = messages.rindex { |m| m[:role] == "user" }
        messages[index] = { role: "user", content: override_last_user_content } if index
      end
      messages
    end

    def format(message)
      case message.role
      when "assistant" then { role: "assistant", content: message.content.to_s }
      when "tool" then { role: "user", content: "[Tool result]\n#{message.content}" }
      else { role: "user", content: message.content.to_s }
      end
    end
  end
end
