# frozen_string_literal: true

module Ai
  # Public entry point for the AI subsystem. Chooses an adapter based on
  # ENV["AI_PROVIDER"] and forwards calls to it. If the chosen provider
  # cannot be configured (missing key, unknown name), transparently falls
  # back to the Null adapter so the app never crashes just because AI
  # isn't set up.
  #
  # ── Feature-scoped configuration ─────────────────────────────────────
  #
  # Every method accepts an optional `feature:` kwarg (a String like
  # "chart_of_accounts"). When present, the client looks for
  # feature-specific env vars FIRST and falls back to the global ones:
  #
  #   AI_PROVIDER                          global provider
  #   AI_MODEL                             global model
  #   AI_PROVIDER__CHART_OF_ACCOUNTS       per-feature provider
  #   AI_MODEL__CHART_OF_ACCOUNTS          per-feature model
  #
  # The double underscore separates the scope ("__FEATURE") from the
  # key ("AI_PROVIDER"). It's needed because feature names contain
  # underscores themselves. The suffix is the feature name upcased with
  # underscores preserved:
  #
  #   "chart_of_accounts" → AI_MODEL__CHART_OF_ACCOUNTS
  #
  # A feature that declares no override behaves exactly as before: it
  # uses the global config.
  #
  #   Ai::Client.complete(messages: [...])
  #   Ai::Client.complete(messages: [...], feature: "chart_of_accounts")
  #   Ai::Client.available?
  #   Ai::Client.available?(feature: "chart_of_accounts")
  #   Ai::Client.provider_name
  #   Ai::Client.provider_name(feature: "chart_of_accounts")
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

    # Memoized adapter instances, keyed by feature name (nil → "").
    # Initialized eagerly so the first reader doesn't have to race.
    @adapters       = {}
    @adapters_mutex = Mutex.new

    class << self
      def complete(messages:, tools: nil, system: nil, model: nil, feature: nil)
        adapter(feature: feature).complete(
          messages: messages,
          tools:    tools,
          system:   system,
          model:    model
        )
      end

      def available?(feature: nil)
        adapter(feature: feature).available?
      end

      def provider_name(feature: nil)
        adapter(feature: feature).name
      end

      # Returns the adapter for the given feature (or the global default
      # when feature is nil). Memoized per feature for the process
      # lifetime. Adapter construction is cheap (no I/O), so holding the
      # mutex across construction is fine.
      #
      # `with_adapter(instance)` installs a thread-local override that
      # shadows ALL feature slots for the duration of a block — used by
      # tests that want to inject a Fake adapter without knowing the
      # feature key.
      def adapter(feature: nil)
        override = Thread.current[:ai_client_adapter_override]
        return override if override

        @adapters_mutex.synchronize do
          @adapters[normalize_feature_key(feature)] ||= build_adapter(feature: feature)
        end
      end

      # Clears memoized adapters. With no argument, clears every feature
      # slot. With a `feature:`, clears only that slot.
      def reset_adapter!(feature: nil)
        @adapters_mutex.synchronize do
          if feature.nil?
            @adapters.clear
          else
            @adapters.delete(normalize_feature_key(feature))
          end
        end
      end

      # Test helper — replaces the adapter for the duration of a block.
      # The override shadows every feature slot, so a spec can inject a
      # Fake adapter regardless of which feature the code under test uses.
      def with_adapter(instance)
        previous = Thread.current[:ai_client_adapter_override]
        Thread.current[:ai_client_adapter_override] = instance
        yield
      ensure
        Thread.current[:ai_client_adapter_override] = previous
      end

      private

      def normalize_feature_key(feature)
        feature.to_s
      end

      def build_adapter(feature: nil)
        provider = env_for(feature, "AI_PROVIDER").to_s.strip.downcase

        return Ai::Adapters::Null.new if provider.blank?

        klass_name = provider_class_name(provider)
        unless klass_name
          Rails.logger.warn(
            "[Ai::Client] Unknown AI_PROVIDER=#{provider.inspect} " \
            "(feature=#{feature.inspect}); falling back to Null"
          )
          return Ai::Adapters::Null.new
        end

        # Pass the resolved model (possibly nil) into the adapter. Adapters
        # fall back to their own DEFAULT_MODEL when nil is passed.
        klass_name.constantize.new(model: env_for(feature, "AI_MODEL").presence)
      rescue Ai::ConfigurationError => e
        Rails.logger.warn(
          "[Ai::Client] Falling back to Null adapter (feature=#{feature.inspect}): #{e.message}"
        )
        Ai::Adapters::Null.new
      end

      def provider_class_name(provider)
        return PROVIDERS[provider] if PROVIDERS.key?(provider)
        return TEST_PROVIDERS[provider] if Rails.env.test? && TEST_PROVIDERS.key?(provider)
        nil
      end

      # Read a feature-scoped env var (e.g. AI_MODEL__CHART_OF_ACCOUNTS),
      # falling back to the global key (AI_MODEL). Returns nil when
      # neither is set.
      def env_for(feature, base_key)
        feature_key = feature_env_key(feature, base_key)
        if feature_key
          value = ENV[feature_key]
          return value if value.present?
        end

        ENV[base_key]
      end

      def feature_env_key(feature, base_key)
        name = normalize_feature_key(feature)
        return nil if name.blank?

        "#{base_key}__#{name.upcase}"
      end
    end
  end
end