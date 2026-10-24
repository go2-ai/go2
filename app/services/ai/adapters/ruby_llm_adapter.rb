# frozen_string_literal: true

require "ruby_llm"

module Ai
  module Adapters
    # Base for adapters that talk to a provider through RubyLLM
    # (https://rubyllm.com). Subclasses name the RubyLLM provider and its
    # base URL; this class translates between the app's OpenAI-style
    # messages/tools and RubyLLM, and normalizes the result to Ai::Response.
    #
    # Two kinds of tools can be passed to #complete:
    #   tools:        OpenAI-style definitions of "final" tools. Their calls
    #                 are never executed here: they are returned to the
    #                 caller (e.g. a proposal the service validates).
    #   lookup_tools: RubyLLM::Tool instances (read-only data lookups). When
    #                 the model only calls lookup tools, RubyLLM runs them,
    #                 sends the results back, and asks again — up to
    #                 MAX_LOOKUP_ROUNDS times.
    #
    # RubyLLM's own retries are disabled: retry policy stays with the
    # caller (Ai::ToolCallingService), which sees typed Ai::Error classes.
    class RubyLlmAdapter < Base
      MAX_LOOKUP_ROUNDS = 8

      def initialize(
        api_key: ENV["AI_API_KEY"],
        model: nil,
        read_timeout: (ENV["AI_READ_TIMEOUT"] || 60).to_i,
        referer: ENV["AI_REFERER"],
        app_title: ENV["AI_APP_TITLE"]
      )
        raise Ai::ConfigurationError, "AI_API_KEY is not set" if api_key.blank?

        @api_key      = api_key
        @model        = model.presence || ENV["AI_MODEL"].presence || self.class::DEFAULT_MODEL
        @read_timeout = read_timeout
        @referer      = referer
        @app_title    = app_title
      end

      def available?
        true
      end

      def complete(messages:, tools: nil, system: nil, model: nil, lookup_tools: nil)
        chat = build_chat(model.presence || @model)
        chat.with_instructions(system) if system.present?
        Array(messages).each { |message| add_message(chat, message) }

        final_tools = Array(tools).map { |definition| DefinitionTool.new(definition) }
        lookups = Array(lookup_tools)
        chat.with_tools(*final_tools, *lookups) if final_tools.any? || lookups.any?

        response = nil
        rounds = 0
        # Tokens of every round (lookup rounds included), not just the last.
        tokens = { input: 0, output: 0 }
        loop do
          response = chat.generate
          tokens[:input] += response.tokens&.input.to_i
          tokens[:output] += response.tokens&.output.to_i
          calls = response.tool_calls&.values || []
          break if calls.empty?
          break if calls.any? { |call| lookups.none? { |tool| tool.name == call.name } }
          break if (rounds += 1) > MAX_LOOKUP_ROUNDS

          chat.run_tools
        end

        build_response(response, tokens)
      rescue RubyLLM::RateLimitError => e
        raise Ai::RateLimitError, "#{label} rate limit exceeded: #{e.message}"
      rescue RubyLLM::UnauthorizedError, RubyLLM::ForbiddenError
        # The provider's message isn't passed on (it can contain key details).
        raise Ai::AuthenticationError, "#{label} authentication failed"
      rescue RubyLLM::ServerError, RubyLLM::ServiceUnavailableError, RubyLLM::OverloadedError => e
        raise Ai::ServerError, "#{label} server error: #{e.message}"
      rescue RubyLLM::BadRequestError, RubyLLM::PaymentRequiredError,
             RubyLLM::ContextLengthExceededError, RubyLLM::ContentFilterError => e
        raise Ai::ClientError, "#{label} client error: #{e.message}"
      rescue RubyLLM::ToolCallParseError => e
        raise Ai::ResponseParseError, "#{label} returned malformed tool call arguments: #{e.message}"
      rescue RubyLLM::Error => e
        raise Ai::ResponseParseError, "#{label} error: #{e.message}"
      rescue Faraday::TimeoutError, Net::OpenTimeout, Net::ReadTimeout => e
        raise Ai::NetworkError, "#{label} request timed out: #{e.message}"
      rescue Faraday::ConnectionFailed, Faraday::SSLError, SocketError, Errno::ECONNREFUSED,
             Errno::ECONNRESET => e
        raise Ai::NetworkError, "#{label} network error: #{e.message}"
      rescue Faraday::ParsingError, JSON::ParserError => e
        raise Ai::ResponseParseError, "#{label} returned non-JSON body: #{e.message}"
      rescue NoMethodError, TypeError => e
        # RubyLLM reads the body as a Hash; an HTML or other non-JSON body
        # surfaces as a method missing on String.
        raise if e.backtrace.to_a.none? { |line| line.include?("ruby_llm") }

        raise Ai::ResponseParseError, "#{label} returned non-JSON body: #{e.message}"
      end

      # A final tool known only by its OpenAI-style definition. It is
      # offered to the model but never executed.
      class DefinitionTool < RubyLLM::Tool
        def initialize(definition)
          super()
          @function = (definition[:function] || definition["function"] || {}).with_indifferent_access
        end

        def name
          @function[:name].to_s
        end

        def description
          @function[:description].to_s
        end

        def parameters_schema
          @function[:parameters] || { "type" => "object", "properties" => {} }
        end

        def execute(**)
          { error: "This tool's input is handled by the application, not executed." }
        end
      end

      private

      attr_reader :api_key, :read_timeout, :referer, :app_title

      def label
        self.class.name.demodulize
      end

      # The RubyLLM provider (e.g. :openrouter) and its base URL.
      def provider_slug
        raise NotImplementedError
      end

      def api_base
        self.class::API_BASE
      end

      def build_chat(model_id)
        context = RubyLLM.context do |config|
          configure(config)
          config.request_timeout = read_timeout
          config.max_retries = 0
          # Send instructions as "system": many OpenAI-compatible routers
          # and open models don't know the newer "developer" role.
          config.openai_use_system_role = true
          # At debug level RubyLLM logs whole prompts and tool results
          # (chart of accounts, balances): never below info.
          config.logger = self.class.logger
        end
        context.chat(model: model_id, provider: provider_slug, assume_model_exists: true)
      end

      def self.logger
        @logger ||= InfoLogger.new
      end

      # Forwards RubyLLM's info, warnings and errors to the Rails log and
      # drops its debug output.
      class InfoLogger < ::Logger
        def initialize
          super(nil)
          self.level = ::Logger::INFO
        end

        def add(severity, message = nil, progname = nil, &)
          return true if (severity || ::Logger::UNKNOWN) < level

          Rails.logger.add(severity, message, progname, &)
        end
      end
      def configure(config)
        config.openrouter_api_key = api_key
        config.openrouter_api_base = api_base
        config.openrouter_app_url = referer if referer.present?
        config.openrouter_app_name = app_title if app_title.present?
      end

      # Messages are OpenAI-style hashes. Tool results were flattened into
      # user messages by the prompt builders, so only these roles occur.
      def add_message(chat, message)
        role = (message[:role] || message["role"]).to_s
        content = (message[:content] || message["content"]).to_s
        role = "user" unless %w[system user assistant].include?(role)
        chat.add_message(role: role.to_sym, content: content)
      end

      def build_response(message, tokens)
        usage = if (tokens[:input] + tokens[:output]).positive?
          {
            "prompt_tokens" => tokens[:input],
            "completion_tokens" => tokens[:output],
            "total_tokens" => tokens[:input] + tokens[:output]
          }
        end

        Ai::Response.new(
          content:    message.content.is_a?(String) ? message.content : message.content.to_s,
          tool_calls: (message.tool_calls&.values || []).map { |tc| { id: tc.id, name: tc.name, arguments: tc.arguments } },
          raw:        message.raw.respond_to?(:body) ? message.raw.body : {},
          usage:      usage,
          provider:   name,
          model:      message.model.to_s.presence || @model
        )
      end
    end
  end
end
