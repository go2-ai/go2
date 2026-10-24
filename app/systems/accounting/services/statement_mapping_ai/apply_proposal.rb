module Accounting
  module StatementMappingAi
    # Applies the selected changes of the chat's proposal to the layout's
    # rules, in one transaction: re-validated against the current rules,
    # then removals, updates and additions. The resulting rule set must not
    # contain rules equal in priority and specificity on the same balances.
    #
    # The chat stays open (the user may continue mapping); the applied
    # change indexes are recorded in its state.
    class ApplyProposal
      Result = Struct.new(:success, :errors, :applied, keyword_init: true) do
        def success? = success
      end

      def self.call(...)
        new(...).call
      end

      def initialize(chat:, indexes: nil)
        @chat = chat
        @indexes = indexes&.map(&:to_i)
      end

      def call
        ActiveRecord::Base.transaction do
          # Read the proposal under the lock: an assistant turn may replace it.
          chat.lock!
          return failure([ error_t("busy") ]) if chat.processing?

          raw = chat.state["latest_proposal"]
          return failure([ error_t("no_proposal") ]) if raw.blank?

          layout = chat.subject.statement_layout
          layout.lock!
          proposal = Proposal.from(raw, layout: layout)
          selected = proposal.selection(indexes)
          errors = proposal.errors(selected)
          return failure(errors.map(&:to_s)) if errors.any?

          apply!(layout, proposal, selected)
          chat.update!(state: chat.state.merge("applied" => Array(chat.state["applied"]) + [
            { "indexes" => selected, "at" => Time.current.iso8601 }
          ]))
          Result.new(success: true, errors: [], applied: selected)
        end
      rescue ActiveRecord::RecordInvalid => e
        failure(e.record.errors.full_messages)
      rescue Invalid => e
        failure(e.messages)
      end

      private

      attr_reader :chat, :indexes

      # Raised inside the transaction to roll the changes back.
      class Invalid < StandardError
        attr_reader :messages

        def initialize(messages)
          @messages = messages
          super(messages.join("; "))
        end
      end

      def apply!(layout, proposal, selected)
        entries = proposal.merged_entries(selected)
        records, errors = Accounting::Statements::ProposedRules.build(layout, entries)
        raise Invalid, errors.flat_map { |error| error[:messages] } if errors.any?

        kept_ids = entries.filter_map { |entry| entry["id"] }
        layout.rules.where.not(id: kept_ids).destroy_all
        saved = layout.rules.reload.index_by(&:id)
        records.each_with_index do |record, index|
          id = entries[index]["id"]
          # A rule removed since the proposal was made (the layout is locked now).
          raise Invalid, [ error_t("rules_changed") ] if id && !saved.key?(id)

          rule = id ? saved.fetch(id) : layout.rules.new
          rule.assign_attributes(record.attributes.except("id", "created_at", "updated_at"))
          rule.position = index + 1
          rule.skip_overlap_check = true
          rule.save!
        end
        ensure_no_equal_overlaps!(layout)
      end

      def ensure_no_equal_overlaps!(layout)
        layout.rules.reload.each do |rule|
          other = rule.equal_overlapping_rule
          next unless other

          rule.errors.add(:base, Accounting::StatementMappingRule.model_t("errors.overlapping_rule", line: other.line&.label))
          raise ActiveRecord::RecordInvalid, rule
        end
      end

      def error_t(key)
        I18n.t("controllers.statement_mapping_ai.errors.#{key}")
      end

      def failure(messages)
        Result.new(success: false, errors: messages, applied: [])
      end
    end
  end
end
