# frozen_string_literal: true

module Ai
  module Adapters
    # Used when no real provider is configured. Returns a canned
    # assistant message so the UI has something to render and tests
    # have a stable, deterministic response. Never touches the network.
    class Null < Base
      DEFAULT_CONTENT = "AI is not configured for this environment. " \
                        "Set AI_PROVIDER and AI_API_KEY to enable it."

      def complete(messages:, tools: nil, system: nil, model: nil)
        Ai::Response.new(
          content: DEFAULT_CONTENT,
          tool_calls: [],
          raw: {
            provider: "null",
            received_messages: messages.length,
            received_tools: Array(tools).map { |t| t.dig(:function, :name) || t.dig("function", "name") }
          },
          usage: nil
        )
      end

      def available?
        false
      end
    end
  end
end
