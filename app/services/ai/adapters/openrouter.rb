# frozen_string_literal: true

module Ai
  module Adapters
    # OpenRouter (https://openrouter.ai), through RubyLLM's OpenRouter
    # provider. One API key works for free-tier models in development and
    # paid models in production; switching models is an ENV change.
    #
    # Environment variables:
    #   AI_API_KEY         — required
    #   AI_MODEL           — optional; defaults to DEFAULT_MODEL
    #   AI_READ_TIMEOUT    — optional; defaults to 60 (seconds); RubyLLM has one
    #                        request timeout, no separate connect timeout
    #   AI_REFERER         — optional; OpenRouter analytics
    #   AI_APP_TITLE       — optional; OpenRouter analytics
    #
    # Ai::Client resolves the model from feature-scoped env vars
    # (AI_MODEL__FEATURE) and the global AI_MODEL and passes it via
    # `model:`; nil falls back to DEFAULT_MODEL.
    #
    # This adapter does NOT retry. 429/5xx/network errors are raised as
    # typed exceptions and left to the caller to handle.
    class Openrouter < RubyLlmAdapter
      API_BASE = "https://openrouter.ai/api/v1"
      DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free"

      private

      def provider_slug
        :openrouter
      end
    end
  end
end
