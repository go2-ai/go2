module Accounting
  module Statements
    # A complete set of mapping rules for a layout that isn't saved yet
    # (an edit preview or an AI proposal), validated like saved rules and
    # turned into Engine::Rule structs.
    #
    # Each entry: line_key, opposite_line_key, selector_type, selector,
    # center_level, center_ids, center_type_ids, currency_ids, grain,
    # measure, priority, note; `id` when it keeps a saved rule.
    module ProposedRules
      class Invalid < StandardError
        attr_reader :messages

        def initialize(messages)
          @messages = messages
          super(messages.join("; "))
        end
      end

      # More rules than any statement needs: a bound on preview requests.
      MAX_ENTRIES = 500
      ATTRIBUTES = %w[selector_type selector center_level center_ids center_type_ids currency_ids grain measure
                      priority note].freeze

      module_function

      # Returns [records, errors]: unsaved StatementMappingRule records and
      # [{ index:, messages: [] }] for the invalid ones.
      def build(layout, entries)
        lines = layout.lines.index_by(&:key)
        errors = []
        records = Array(entries).each_with_index.map do |entry, index|
          entry = entry.to_h.stringify_keys
          rule = layout.rules.build(entry.slice(*ATTRIBUTES).merge(
            "line" => lines[entry["line_key"].to_s],
            "opposite_line" => entry["opposite_line_key"].presence && lines[entry["opposite_line_key"].to_s],
            "position" => index + 1
          ))
          rule.skip_overlap_check = true
          messages = rule.valid? ? [] : rule.errors.full_messages
          messages << Accounting::StatementMappingRule.model_t("errors.unknown_line", key: entry["line_key"]) if rule.line.nil?
          if entry["opposite_line_key"].present? && rule.opposite_line.nil?
            messages << Accounting::StatementMappingRule.model_t("errors.unknown_line", key: entry["opposite_line_key"])
          end
          errors << { index: index, messages: messages.uniq } if messages.any?
          rule
        end
        # Built through the association: keep them out of it.
        layout.rules.reset
        [ records, errors ]
      end

      def parse(layout, raw)
        entries = raw.is_a?(String) ? JSON.parse(raw) : raw
        entries = entries.map { |entry| entry.respond_to?(:to_unsafe_h) ? entry.to_unsafe_h : entry } if entries.is_a?(Array)
        unless entries.is_a?(Array) && entries.size <= MAX_ENTRIES && entries.all?(Hash)
          raise Invalid, [ Accounting::StatementMappingRule.model_t("errors.invalid_rules") ]
        end

        records, errors = build(layout, entries)
        raise Invalid, errors.flat_map { |error| error[:messages].map { |m| "##{error[:index] + 1}: #{m}" } } if errors.any?

        records.each_with_index.map do |record, index|
          Engine::Rule.new(
            id: "p#{index + 1}", line_key: record.line.key, opposite_line_key: record.opposite_line&.key,
            selector_type: record.selector_type, selector: record.selector.to_h, center_level: record.center_level,
            center_ids: record.center_ids.to_a, center_type_ids: record.center_type_ids.to_a,
            currency_ids: record.currency_ids.to_a, grain: record.grain, measure: record.measure,
            priority: record.priority, specificity: record.specificity, position: index + 1
          )
        end
      rescue JSON::ParserError
        raise Invalid, [ Accounting::StatementMappingRule.model_t("errors.invalid_rules") ]
      end
    end
  end
end
