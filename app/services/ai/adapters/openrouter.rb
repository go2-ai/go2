# frozen_string_literal: true

require "net/http"
require "json"
require "uri"

module Ai
  module Adapters
    # Talks to OpenRouter's OpenAI-compatible /chat/completions endpoint.
    #
    # Why OpenRouter: one API key works for free-tier models in
    # development and paid models in production. Switching models is an
    # ENV change, not a code change.
    #
    # Environment variables:
    #   AI_API_KEY         — required
    #   AI_MODEL           — optional; defaults to DEFAULT_MODEL
    #   AI_OPEN_TIMEOUT    — optional; defaults to 5 (seconds)
    #   AI_READ_TIMEOUT    — optional; defaults to 60 (seconds)
    #   AI_REFERER         — optional; OpenRouter analytics
    #   AI_APP_TITLE       — optional; OpenRouter analytics
    #
    # This adapter does NOT retry. 429/5xx/network errors are raised as
    # typed exceptions and left to the caller to handle.
    class Openrouter < Base
      API_URL = URI("https://openrouter.ai/api/v1/chat/completions")
      DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free"

      def initialize(
        api_key: ENV["AI_API_KEY"],
        model: ENV["AI_MODEL"].presence || self.class::DEFAULT_MODEL,
        open_timeout: (ENV["AI_OPEN_TIMEOUT"] || 5).to_i,
        read_timeout: (ENV["AI_READ_TIMEOUT"] || 60).to_i,
        referer: ENV["AI_REFERER"],
        app_title: ENV["AI_APP_TITLE"]
      )
        raise Ai::ConfigurationError, "AI_API_KEY is not set" if api_key.blank?

        @api_key      = api_key
        @model        = model
        @open_timeout = open_timeout
        @read_timeout = read_timeout
        @referer      = referer
        @app_title    = app_title
      end

      def complete(messages:, tools: nil, system: nil, model: nil)
        payload = build_payload(messages: messages, tools: tools, system: system, model: model)
        response = perform_request(payload)
        parse_response(response)
      end

      def available?
        true
      end

      private

      attr_reader :api_key, :model, :open_timeout, :read_timeout, :referer, :app_title

      def build_payload(messages:, tools:, system:, model:)
        full_messages = []
        full_messages << { role: "system", content: system } if system.present?
        full_messages.concat(messages)

        payload = {
          model: model.presence || @model,
          messages: full_messages
        }

        if tools.present?
          payload[:tools] = tools
          payload[:tool_choice] = "auto"
        end

        payload
      end

      def perform_request(payload)
        api_url = self.class::API_URL
        http = Net::HTTP.new(api_url.host, api_url.port)
        http.use_ssl = true
        http.open_timeout = open_timeout
        http.read_timeout = read_timeout

        request = Net::HTTP::Post.new(api_url.request_uri)
        request["Authorization"] = "Bearer #{api_key}"
        request["Content-Type"]  = "application/json"
        request["HTTP-Referer"]  = referer if referer.present?
        request["X-Title"]       = app_title if app_title.present?
        request.body = payload.to_json

        begin
          http.request(request)
        rescue Net::OpenTimeout, Net::ReadTimeout => e
          raise Ai::NetworkError, "OpenRouter request timed out: #{e.message}"
        rescue SocketError, Errno::ECONNREFUSED, Errno::ECONNRESET, OpenSSL::SSL::SSLError => e
          raise Ai::NetworkError, "OpenRouter network error: #{e.message}"
        end
      end

      def parse_response(response)
        body = parse_body(response.body)
        provider_label = self.class.name.demodulize

        case response.code.to_i
        when 200..299
          build_response(body)
        when 401, 403
          raise Ai::AuthenticationError, "#{provider_label} authentication failed: ..."
        when 429
          raise Ai::RateLimitError,
                "#{provider_label} rate limit exceeded: #{error_message(body) || response.code}"
        when 400..499
          raise Ai::ClientError,
                "#{provider_label} client error (#{response.code}): #{error_message(body) || 'unknown'}"
        when 500..599
          raise Ai::ServerError,
                "#{provider_label} server error (#{response.code}): #{error_message(body) || 'unknown'}"
        else
          raise Ai::ResponseParseError,
                "Unexpected #{provider_label} status #{response.code}"
        end
      end

      def parse_body(body)
        return {} if body.blank?
        JSON.parse(body)
      rescue JSON::ParserError => e
        raise Ai::ResponseParseError, "#{provider_label} returned non-JSON body: #{e.message}"
      end

      def error_message(body)
        body.dig("error", "message") || body["message"]
      end

      def build_response(body)
        choice = body.dig("choices", 0) || {}
        message = choice["message"] || {}

        Ai::Response.new(
          content: message["content"].to_s,
          tool_calls: parse_tool_calls(message["tool_calls"]),
          raw: body,
          usage: body["usage"]
        )
      end

      def parse_tool_calls(raw_tool_calls)
        Array(raw_tool_calls).map do |tc|
          function = tc["function"] || {}
          {
            id: tc["id"],
            name: function["name"],
            arguments: function["arguments"]
          }
        end
      end
    end
  end
end
