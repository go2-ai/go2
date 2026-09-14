# frozen_string_literal: true

module Ai
  module Adapters
    # NaraRouter adapter. Speaks the OpenAI-compatible /v1/chat/completions
    # protocol, so it inherits everything from Openrouter except the base URL
    # and default model.
    #
    # Free tier: 5M tokens/day, no credit card. Model availability on the
    # free tier rotates — check https://router.bynara.id/models for the
    # current free-model list. All free models support tool calling.
    #
    # Env vars: same as Openrouter (AI_API_KEY required, AI_MODEL optional,
    # AI_OPEN_TIMEOUT / AI_READ_TIMEOUT / AI_REFERER / AI_APP_TITLE optional).
    class Nararouter < Openrouter
      API_URL = URI("https://router.bynara.id/v1/chat/completions")
      DEFAULT_MODEL = "agnes-2.5-flash"
    end
  end
end
