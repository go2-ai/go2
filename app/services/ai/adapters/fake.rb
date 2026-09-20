# frozen_string_literal: true

module Ai
  module Adapters
    # Test-only adapter. Constructed with a pre-scripted list of items;
    # each call to #complete shifts one off the queue:
    #
    #   - an Ai::Response → returned to the caller
    #   - an Ai::Error    → raised to the caller
    #
    # When the queue is empty, raises ScriptExhausted so tests fail loudly
    # rather than silently returning stale data.
    #
    # Only registered in Ai::Client's PROVIDERS map when Rails.env.test?
    # — the class body itself lives in app/ so that integration tests
    # (and any future real-console debugging) can reach it without
    # load-path gymnastics.
    class Fake < Base
      class ScriptExhausted < Ai::Error; end

      attr_reader :calls

      def initialize(responses: [])
        @responses = Array(responses).dup
        @calls     = []
      end

      def complete(messages:, tools: nil, system: nil, model: nil)
        @calls << { messages: messages, tools: tools, system: system, model: model }

        raise ScriptExhausted, "Fake adapter has no more scripted responses (call ##{@calls.length})" if @responses.empty?

        item = @responses.shift
        raise item if item.is_a?(Ai::Error)

        item
      end

      def available?
        true
      end

      def name
        "fake"
      end

      # Test helper: peek at what's left.
      def remaining_responses
        @responses.length
      end
    end
  end
end
