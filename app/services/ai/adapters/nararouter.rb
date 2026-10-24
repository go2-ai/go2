# frozen_string_literal: true

module Ai
  module Adapters
    # NaraRouter adapter. Speaks OpenRouter's OpenAI-compatible
    # /v1/chat/completions protocol, so it uses RubyLLM's OpenRouter
    # provider with a different base URL and default model.
    #
    # Free tier: 5M tokens/day, no credit card. Model availability on the
    # free tier rotates — check https://router.bynara.id/models for the
    # current free-model list. All free models support tool calling.
    #
    # Env vars: same as Openrouter.
    class Nararouter < Openrouter
      API_BASE = "https://router.bynara.id/v1"
      DEFAULT_MODEL = "agnes-2.5-flash"
    end
  end
end
