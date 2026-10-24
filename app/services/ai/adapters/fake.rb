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

      # Like the real adapters, a scripted response whose tool calls all
      # name lookup tools is "executed": the tools run, their results are
      # recorded in #lookup_results, and the next scripted item is used.
      def complete(messages:, tools: nil, system: nil, model: nil, lookup_tools: nil)
        @calls << { messages: messages, tools: tools, system: system, model: model, lookup_tools: lookup_tools }
        lookups = Array(lookup_tools).index_by(&:name)

        loop do
          raise ScriptExhausted, "Fake adapter has no more scripted responses (call ##{@calls.length})" if @responses.empty?

          item = @responses.shift
          raise item if item.is_a?(Ai::Error)
          return item unless item.tool_calls? && item.tool_calls.all? { |tc| lookups.key?(tc[:name]) }

          item.tool_calls.each do |tc|
            result = lookups[tc[:name]].call(**tc[:arguments].to_h.symbolize_keys)
            lookup_results << { name: tc[:name], arguments: tc[:arguments], result: result }
          end
        end
      end

      def lookup_results
        @lookup_results ||= []
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
