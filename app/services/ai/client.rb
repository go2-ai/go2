# frozen_string_literal: true

module Ai
  # Public entry point for the AI subsystem. Chooses an adapter based on
  # ENV["AI_PROVIDER"] and forwards calls to it. If the chosen provider
  # cannot be configured (missing key, unknown name), transparently falls
  # back to the Null adapter so the app never crashes just because AI
  # isn't set up.
  #
  #   Ai::Client.complete(messages: [...], tools: [...], system: "...")
  #   Ai::Client.available?
  #   Ai::Client.provider_name
  module Client
    PROVIDERS = {
      "openrouter" => "Ai::Adapters::Openrouter",
      "nararouter" => "Ai::Adapters::Nararouter",
      "null"       => "Ai::Adapters::Null"
    }.freeze

    # Additional providers registered only in test env. Kept out of
    # PROVIDERS so production never has a stale "fake" entry even if
    # someone accidentally sets AI_PROVIDER=fake.
    TEST_PROVIDERS = {
      "fake" => "Ai::Adapters::Fake"
    }.freeze

    class << self
      def complete(messages:, tools: nil, system: nil, model: nil)
        adapter.complete(messages: messages, tools: tools, system: system, model: model)
      end

      def available?
        adapter.available?
      end

      def provider_name
        adapter.name
      end

      # Returns the current adapter instance. Memoized per-process for
      # the common case (a single configured provider for the whole app).
      # Call `reset_adapter!` in tests between examples to force a rebuild
      # when ENV changes.
      def adapter
        @adapter ||= build_adapter
      end

      def reset_adapter!
        @adapter = nil
      end

      # Test helper — replaces the memoized adapter for the duration of a
      # block. Useful when a spec needs to inject a Fake adapter with a
      # specific response script without touching ENV.
      def with_adapter(instance)
        previous = @adapter
        @adapter = instance
        yield
      ensure
        @adapter = previous
      end

      private

      def build_adapter
        provider = ENV["AI_PROVIDER"].to_s.strip.downcase

        return Ai::Adapters::Null.new if provider.blank?

        klass_name = provider_class_name(provider)
        unless klass_name
          Rails.logger.warn("[Ai::Client] Unknown AI_PROVIDER=#{provider.inspect}; falling back to Null")
          return Ai::Adapters::Null.new
        end

        klass_name.constantize.new
      rescue Ai::ConfigurationError => e
        Rails.logger.warn("[Ai::Client] Falling back to Null adapter: #{e.message}")
        Ai::Adapters::Null.new
      end

      def provider_class_name(provider)
        return PROVIDERS[provider] if PROVIDERS.key?(provider)
        return TEST_PROVIDERS[provider] if Rails.env.test? && TEST_PROVIDERS.key?(provider)
        nil
      end
    end
  end
end
