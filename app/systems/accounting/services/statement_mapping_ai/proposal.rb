module Accounting
  module StatementMappingAi
    # A mapping proposal from the assistant: changes to a layout's rules.
    #
    #   {
    #     "summary" => "...",
    #     "changes" => [
    #       { "action" => "add", "line_key" => "trade_and_other_receivables",
    #         "selector_type" => "ledger", "selector" => { "ledger_codes" => ["111"] },
    #         "opposite_line_key" => "contract_liabilities", "grain" => "account_center1",
    #         "reason" => "...", "confidence" => 0.9 },
    #       { "action" => "update", "rule_number" => 3, "priority" => 5, ... },
    #       { "action" => "remove", "rule_number" => 4, "reason" => "..." }
    #     ]
    #   }
    #
    # The assistant names ledgers and accounts by their full codes and
    # categories by identifier; they are resolved to ids here, so a
    # proposal can't point at another organization's records.
    class Proposal
      ACTIONS = %w[add update remove].freeze
      RULE_FIELDS = %w[line_key opposite_line_key selector_type center_level grain measure priority note].freeze
      SELECTOR_KEYS = %w[identifiers ledger_codes account_codes settings from to period].freeze
      # The selector type a change's selector keys imply, when it doesn't say.
      INFERRED_TYPES = { "ledger_codes" => "ledger", "account_codes" => "account", "settings" => "account",
                         "identifiers" => "category", "from" => "account_range", "period" => "profit_or_loss" }.freeze

      Error = Struct.new(:path, :field, :message, keyword_init: true) do
        def to_s = "#{path}: #{message}"
      end

      # Messages are shown to the user and sent back to the model.
      def self.message(key, **options)
        I18n.t("controllers.statement_mapping_ai.proposal_errors.#{key}", **options)
      end
      attr_reader :summary, :changes, :layout

      def self.from(arguments, layout:)
        new(arguments.to_h.deep_stringify_keys, layout: layout)
      end

      def initialize(arguments, layout:)
        @layout = layout
        @summary = arguments["summary"].to_s
        @changes = Array(arguments["changes"]).map { |change| change.is_a?(Hash) ? normalize(change) : {} }
      end

      # Saved rules by number ("Rule 3" in the editor).
      def saved_rules
        @saved_rules ||= layout.rules.to_a.each_with_index.to_h { |rule, index| [ index + 1, rule ] }
      end

      # Errors of the changes themselves (unknown codes, rules, actions)
      # and of the resulting rule set.
      def errors(selected = nil)
        list = []
        changes.each_with_index do |change, index|
          next if selected && !selected.include?(index)

          path = "changes[#{index}]"
          action = change["action"].to_s
          unless ACTIONS.include?(action)
            list << Error.new(path: path, field: "action", message: message(:action))
            next
          end
          if action != "add" && !saved_rules.key?(change["rule_number"].to_i)
            list << Error.new(path: path, field: "rule_number", message: message(:no_rule, number: change["rule_number"].inspect))
          end
          next if action == "remove"

          if action == "add" || change.key?("selector_type") || change.key?("selector")
            resolve_selector(change, list, path, selector_type_of(change))
          end
          resolve_centers(change, list, path)
          currency_ids(change["currencies"], list, path) if change.key?("currencies")
        end
        return list if list.any?

        entries = merged_entries(selected)
        _records, rule_errors = Accounting::Statements::ProposedRules.build(layout, entries)
        rule_errors.each do |error|
          entry = entries[error[:index]]
          path = entry["change_index"] ? "changes[#{entry['change_index']}]" : "rule #{saved_number(entry['id'])}"
          error[:messages].each { |message| list << Error.new(path: path, field: "rule", message: message) }
        end
        list
      end

      # The selected change indexes (all when none are given).
      def selection(indexes)
        indexes || (0...changes.size).to_a
      end
      # The layout's complete rule set with the (selected) changes applied:
      # entries for Statements::ProposedRules. Saved rules keep their "id".
      def merged_entries(selected = nil)
        keys = layout.lines.to_h { |line| [ line.id, line.key ] }
        entries = saved_rules.transform_values { |rule| saved_entry(rule, keys) }
        added = []
        changes.each_with_index do |change, index|
          next if selected && !selected.include?(index)

          case change["action"]
          when "remove" then entries.delete(change["rule_number"].to_i)
          when "update"
            number = change["rule_number"].to_i
            entries[number] = entries[number].merge(entry_for(change, partial: true), "change_index" => index) if entries[number]
          when "add" then added << entry_for(change).merge("change_index" => index)
          end
        end
        entries.values + added
      end

      def to_h
        { "summary" => summary, "changes" => changes }
      end

      private

      # Models often put the selector's keys next to it, or leave the
      # selector type out: accept both.
      def normalize(change)
        change = change.dup
        selector = change["selector"].is_a?(Hash) ? change["selector"].dup : {}
        SELECTOR_KEYS.each { |key| selector[key] = change.delete(key) if change.key?(key) && !selector.key?(key) }
        change["selector"] = selector if selector.any? || change.key?("selector")
        if change["selector_type"].blank? && change["action"] == "add"
          inferred = INFERRED_TYPES.find { |key, _| selector[key].present? }&.last
          change["selector_type"] = inferred if inferred
        end
        change
      end

      def saved_number(rule_id)
        saved_rules.find { |_, rule| rule.id == rule_id }&.first
      end

      def saved_entry(rule, keys)
        {
          "id" => rule.id, "line_key" => keys[rule.statement_line_id], "opposite_line_key" => keys[rule.opposite_line_id],
          "selector_type" => rule.selector_type, "selector" => rule.selector.to_h, "center_level" => rule.center_level,
          "center_ids" => rule.center_ids.to_a, "center_type_ids" => rule.center_type_ids.to_a,
          "currency_ids" => rule.currency_ids.to_a, "grain" => rule.grain, "measure" => rule.measure,
          "priority" => rule.priority, "note" => rule.note
        }
      end

      def entry_for(change, partial: false)
        entry = change.slice(*RULE_FIELDS)
        entry["note"] ||= change["reason"] unless partial
        if change.key?("selector_type") || change.key?("selector")
          entry["selector_type"] = selector_type_of(change)
          entry["selector"] = resolve_selector(change, [], "", entry["selector_type"])
        end
        if change.key?("center_codes") || change.key?("center_type_names")
          entry["center_ids"], entry["center_type_ids"] = resolve_centers(change, [], "")
        end
        entry["currency_ids"] = currency_ids(change["currencies"], [], "") if change.key?("currencies")
        entry["grain"] ||= "account" unless partial
        entry["measure"] ||= "balance" unless partial
        entry
      end

      # Codes and identifiers → the selector the rules store.
      def selector_type_of(change)
        change["selector_type"].presence || saved_rules[change["rule_number"].to_i]&.selector_type
      end

      def resolve_selector(change, errors, path, type)
        data = change["selector"].to_h
        type = type.to_s
        case type
        when "category"
          required(errors, path, "selector.identifiers", data["identifiers"])
          identifiers = Array(data["identifiers"]).map(&:to_s)
          unknown = identifiers - categories.keys
          errors << Error.new(path: path, field: "selector.identifiers", message: message(:unknown, values: unknown.join(", "))) if unknown.any?
          { "identifiers" => identifiers & categories.keys }
        when "ledger"
          required(errors, path, "selector.ledger_codes", data["ledger_codes"])
          { "ids" => lookup(ledgers, data["ledger_codes"], errors, path, "selector.ledger_codes") }
        when "account"
          if Array(data["account_codes"]).empty? && Array(data["settings"]).empty?
            errors << Error.new(path: path, field: "selector.account_codes", message: message(:account_selector))
          end
          ids = lookup(accounts, data["account_codes"], errors, path, "selector.account_codes")
          settings = Array(data["settings"]).map(&:to_s)
          { "ids" => ids, "settings" => settings }.compact_blank
        when "account_range"
          required(errors, path, "selector.from", data["from"])
          required(errors, path, "selector.to", data["to"])
          { "from" => data["from"].to_s, "to" => data["to"].to_s }
        when "profit_or_loss"
          unless %w[current prior].include?(data["period"].to_s)
            errors << Error.new(path: path, field: "selector.period", message: message(:period))
          end
          { "period" => data["period"].to_s }
        else
          errors << Error.new(path: path, field: "selector_type", message: message(:selector_type, type: type.inspect))
          {}
        end
      end

      def required(errors, path, field, value)
        return if Array(value).compact_blank.any?

        errors << Error.new(path: path, field: field, message: message(:required))
      end

      def resolve_centers(change, errors, path)
        center_ids = lookup(centers, change["center_codes"], errors, path, "center_codes")
        type_ids = Array(change["center_type_names"]).filter_map do |name|
          center_types[name.to_s] || (errors << Error.new(path: path, field: "center_type_names", message: message(:unknown, values: name)) && nil)
        end
        [ center_ids, type_ids ]
      end

      def lookup(index, codes, errors, path, field)
        codes = Array(codes).map(&:to_s)
        unknown = codes - index.keys
        errors << Error.new(path: path, field: field, message: message(:unknown_codes, codes: unknown.join(", "))) if unknown.any?
        codes.filter_map { |code| index[code] }
      end

      def currency_ids(abrs, errors, path)
        lookup(currencies, Array(abrs).map { |abr| abr.to_s.upcase }, errors, path, "currencies")
      end

      def message(...)
        self.class.message(...)
      end
      def organization
        layout.organization
      end

      def categories
        @categories ||= organization.account_categories.where.not(identifier: nil).pluck(:identifier, :id).to_h
      end

      def ledgers
        @ledgers ||= Accounting::Ledger.joins(:account_category).where(account_categories: { organization_id: organization.id })
                                       .includes(:account_category).to_h { |ledger| [ ledger.full_code, ledger.id ] }
      end

      def accounts
        @accounts ||= Accounting::Account.joins(ledger: :account_category)
                                         .where(account_categories: { organization_id: organization.id })
                                         .includes(ledger: :account_category).to_h { |account| [ account.full_code, account.id ] }
      end

      def centers
        @centers ||= Accounting::Center.joins(:center_type).where(center_types: { organization_id: organization.id })
                                       .pluck(:code, :id).to_h
      end

      def center_types
        @center_types ||= organization.center_types.to_a.to_h { |type| [ type.name.to_s, type.id ] }
      end

      def currencies
        @currencies ||= organization.currencies.pluck(:abr, :id).to_h { |abr, id| [ abr.to_s.upcase, id ] }
      end
    end
  end
end
