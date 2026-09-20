# frozen_string_literal: true

module Ai
  module Adapters
    # Abstract interface every adapter implements. Kept intentionally
    # narrow — one method, keyword args, a single normalized return type.
    # If a provider needs extra knobs (temperature, top_p, ...), they
    # belong on that adapter's initializer, not on this signature.
    class Base
      # @param messages [Array<Hash>] chat history in OpenAI-style shape:
      #   [{ role: "user"|"assistant"|"system"|"tool", content: "...", ... }]
      # @param tools [Array<Hash>] tool definitions in OpenAI-style shape:
      #   [{ type: "function", function: { name: "...", description: "...", parameters: {...} } }]
      # @param system [String, nil] optional system prompt
      # @param model [String, nil] model override; falls back to the
      #   adapter's configured default
      # @return [Ai::Response]
      def complete(messages:, tools: nil, system: nil, model: nil)
        raise NotImplementedError, "#{self.class} must implement #complete"
      end

      # Whether this adapter is actually configured and ready to make
      # calls. The Null adapter returns false; a real adapter returns
      # true only if its credentials are present.
      def available?
        raise NotImplementedError, "#{self.class} must implement #available?"
      end

      # Human-readable identifier, useful in logs and error messages.
      def name
        self.class.name.demodulize.underscore
      end
    end
  end
end
