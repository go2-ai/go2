# frozen_string_literal: true

module Ai
  # Normalized response shape returned by every adapter. The service
  # layer above never touches provider-specific JSON — it consumes this
  # object and nothing else.
  #
  # Fields:
  #   content    — the assistant's text, or "" if the response was
  #                tool-call-only (some providers return an empty string
  #                when the assistant decides to call a tool).
  #   tool_calls — array of hashes, each shaped:
  #                  { id: String, name: String, arguments: Hash }
  #                Arguments are already JSON-parsed from the provider's
  #                string-encoded form so callers don't need to re-parse.
  #   raw        — the full parsed provider response body. Kept for
  #                debugging and for storing in AiMessage#metadata when
  #                the caller wants an audit trail.
  #   usage      — token usage hash (provider-specific keys) or nil.
  #   provider   — identifier of the adapter that produced this response
  #                (e.g. "nararouter"). Used for per-message cost
  #                attribution. nil when the adapter didn't set one.
  #   model      — the concrete model the provider actually used for this
  #                call. Recorded per-message because a provider's free
  #                tier can rotate models between calls. nil if unknown.
  class Response
    attr_reader :content, :tool_calls, :raw, :usage, :provider, :model

    def initialize(content: "", tool_calls: [], raw: {}, usage: nil,
                   provider: nil, model: nil)
      @content    = content.to_s
      @tool_calls = Array(tool_calls).map { |tc| normalize_tool_call(tc) }
      @raw        = raw
      @usage      = usage
      @provider   = provider
      @model      = model
    end

    def tool_calls?
      tool_calls.any?
    end

    def first_tool_call
      tool_calls.first
    end

    def to_h
      {
        content: content,
        tool_calls: tool_calls,
        usage: usage,
        provider: provider,
        model: model
      }
    end

    private

    def normalize_tool_call(tc)
      {
        id: tc[:id] || tc["id"],
        name: tc[:name] || tc["name"],
        arguments: normalize_arguments(tc[:arguments] || tc["arguments"])
      }
    end

    # Providers return tool arguments as a JSON-encoded string. We decode
    # them once here so every caller gets a Hash. Malformed JSON becomes
    # an empty hash rather than raising — the service layer will surface
    # a validation error to the user, which is a better UX than a 500.
    def normalize_arguments(args)
      case args
      when Hash
        args
      when String
        return {} if args.strip.empty?
        JSON.parse(args)
      when nil
        {}
      else
        {}
      end
    rescue JSON::ParserError
      {}
    end
  end
end