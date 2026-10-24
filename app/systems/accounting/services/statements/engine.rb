module Accounting
  module Statements
    # Computes a statement from balance rows and the layout's lines and
    # mapping rules. Pure Ruby: rows, lines and rules are passed in (see
    # Row, Line, Rule; .from_layout converts a StatementLayout), so it runs
    # without the database.
    #
    # 1. Each row is resolved to one rule: among the matching rules the
    #    highest priority wins (blank = 0), then the highest specificity.
    #    Rules equal on both conflict (reported in #conflicts; the first by
    #    position is used).
    # 2. Rows of a rule are grouped by its grain. When the rule has an
    #    opposite line and a group's total is on the side opposite to the
    #    line's normal side, the whole group goes to the opposite line
    #    (e.g. customers in credit become advances from customers).
    # 3. A mapped line's value is the amount mapped to it plus its
    #    children, on its normal side. Formula lines are evaluated with
    #    Formula; cycles and evaluation errors are reported in #errors.
    class Engine
      # values: measure => BigDecimal, Σ debit − Σ credit style (debit positive).
      Row = Struct.new(:key, :account_id, :ledger_id, :category_id, :category_identifier, :category_type,
                       :account_code, :center_ids, :center_type_ids, :currency_id, :period, :values,
                       keyword_init: true) do
        def value(measure = "balance")
          values.fetch(measure, BigDecimal("0"))
        end

        def center_id(level)
          center_ids.to_a[level - 1]
        end

        def center_type_id(level)
          center_type_ids.to_a[level - 1]
        end

        # The period matters for income statement rows only.
        def period_key
          category_type.to_s == "income_statement" ? period : nil
        end
      end

      Line = Struct.new(:key, :parent_key, :kind, :normal_side, :formula, keyword_init: true)

      Rule = Struct.new(:id, :line_key, :opposite_line_key, :selector_type, :selector, :center_level, :center_ids,
                        :center_type_ids, :currency_ids, :grain, :measure, :priority, :specificity, :position,
                        keyword_init: true) do
        def effective_priority
          priority || 0
        end
      end

      # One group of rows mapped to a line by a rule.
      Contribution = Struct.new(:line_key, :rule_id, :grain_key, :rows, :amount, :reclassified, keyword_init: true)

      # How one row was resolved: for the inspection list.
      Resolution = Struct.new(:row, :line_key, :rule_id, :overridden_rule_ids, :conflicting_rule_ids,
                              :reclassified, :group_total, :amount, keyword_init: true)

      ZERO = BigDecimal("0")

      attr_reader :lines, :rules, :rows, :setting_accounts

      # setting_accounts: { "retained_earnings_account_id" => 12, ... }
      # rules: Rule structs to use instead of the layout's (previews of
      # unsaved changes, AI proposals).
      # fixed_values: line key => amount on the line's side, computed outside
      # the engine (e.g. cash at the beginning of a cash flow period).
      def self.from_layout(layout, rows:, setting_accounts: {}, rules: nil, fixed_values: {})
        lines = layout.lines.to_a
        keys = lines.to_h { |line| [ line.id, line.key ] }
        new(
          lines: lines.map do |line|
            Line.new(key: line.key, parent_key: keys[line.parent_id], kind: line.kind,
                     normal_side: line.normal_side, formula: line.formula)
          end,
          rules: rules || layout.rules.map { |rule| rule_from_record(rule, keys) },
          rows: rows,
          setting_accounts: setting_accounts,
          fixed_values: fixed_values
        )
      end

      def self.rule_from_record(rule, line_keys)
        Rule.new(
          id: rule.id, line_key: line_keys.fetch(rule.statement_line_id),
          opposite_line_key: line_keys[rule.opposite_line_id], selector_type: rule.selector_type,
          selector: rule.selector.to_h, center_level: rule.center_level, center_ids: rule.center_ids.to_a,
          center_type_ids: rule.center_type_ids.to_a, currency_ids: rule.currency_ids.to_a, grain: rule.grain,
          measure: rule.measure, priority: rule.priority, specificity: rule.specificity, position: rule.position
        )
      end

      def initialize(lines:, rules:, rows:, setting_accounts: {}, fixed_values: {})
        @fixed_values = fixed_values.transform_keys(&:to_s)
        @lines = lines
        @rules = rules.sort_by { |rule| [ rule.position.to_i, rule.id.to_s ] }
        @rows = rows
        @setting_accounts = setting_accounts.transform_keys(&:to_s)
        @lines_by_key = lines.index_by(&:key)
        @errors = []
      end

      def call
        resolve_rows
        map_groups
        compute_values
        self
      end

      # line key => BigDecimal (nil for headings and failed formulas)
      def values
        @values ||= {}
      end

      def contributions
        @contributions ||= []
      end

      def resolutions
        @resolutions ||= []
      end

      # Resolutions of the non-zero rows no rule matched.
      def unmapped
        resolutions.select { |resolution| resolution.rule_id.nil? }
      end

      # [{ rule_ids: [...], rows: n }] rules equal in priority and specificity on the same rows.
      def conflicts
        resolutions.select { |resolution| resolution.conflicting_rule_ids.any? }
                   .group_by { |resolution| ([ resolution.rule_id ] + resolution.conflicting_rule_ids).sort }
                   .map { |rule_ids, list| { rule_ids: rule_ids, rows: list.size } }
      end

      # [{ type:, line_key:, message: }]
      attr_reader :errors

      def contributions_for(line_key)
        contributions.select { |contribution| contribution.line_key == line_key }
      end

      def line(key)
        @lines_by_key[key]
      end

      # Converts a debit-positive amount to the line's side.
      def on_side(line, amount)
        line.normal_side.to_s == "credit" ? -amount : amount
      end

      private

      attr_reader :lines_by_key

      # ── 1. resolution ───────────────────────────────────────────────────

      def resolve_rows
        # Rows are Structs: hash them by identity, not by their values.
        @row_rules = {}.compare_by_identity
        @resolution_by_row = {}.compare_by_identity
        matchers = rules.map { |rule| [ rule, matcher(rule) ] }
        rows.each do |row|
          matching = matchers.filter_map { |rule, match| rule if match.call(row) }
          ranked = matching.sort_by.with_index { |rule, index| [ -rule.effective_priority, -rule.specificity, index ] }
          winner = ranked.first
          if winner.nil?
            next if row.values.values.all?(&:zero?)

            resolution = Resolution.new(row: row, overridden_rule_ids: [], conflicting_rule_ids: [],
                                        reclassified: false, amount: row.value)
          else
            conflicting = ranked.drop(1).select do |rule|
              rule.effective_priority == winner.effective_priority && rule.specificity == winner.specificity
            end
            @row_rules[row] = winner
            resolution = Resolution.new(row: row, rule_id: winner.id,
                                        overridden_rule_ids: (ranked.drop(1) - conflicting).map(&:id),
                                        conflicting_rule_ids: conflicting.map(&:id), reclassified: false)
          end
          resolutions << resolution
          @resolution_by_row[row] = resolution
        end
      end

      # A lambda telling whether a row matches the rule, with the rule's
      # selector and filters normalized once.
      def matcher(rule)
        data = rule.selector.to_h.stringify_keys
        id_set = ->(values) { Array(values).map { |value| Integer(value, exception: false) || value }.to_set }
        selector = case rule.selector_type.to_s
        when "category"
          identifiers = Array(data["identifiers"]).to_set
          ids = id_set.call(data["ids"])
          ->(row) { identifiers.include?(row.category_identifier) || ids.include?(row.category_id) }
        when "ledger"
          ids = id_set.call(data["ids"])
          ->(row) { ids.include?(row.ledger_id) }
        when "account"
          ids = id_set.call(data["ids"])
          Array(data["settings"]).each { |name| ids << setting_accounts[name.to_s] if setting_accounts[name.to_s] }
          ->(row) { ids.include?(row.account_id) }
        when "account_range"
          from = data["from"].to_s
          to = data["to"].to_s
          ->(row) {
            prefix = row.account_code.to_s[0, from.length]
            prefix.length == from.length && prefix >= from && prefix <= to
          }
        when "profit_or_loss"
          period = data["period"].to_s
          ->(row) { row.category_type.to_s == "income_statement" && row.period.to_s == period }
        else
          ->(_row) { false }
        end
        level = rule.center_level
        centers = rule.center_ids.to_a.to_set
        center_types = rule.center_type_ids.to_a.to_set
        center_filter = level.present? && (centers.any? || center_types.any?)
        currencies = rule.currency_ids.to_a.to_set
        lambda do |row|
          selector.call(row) &&
            (!center_filter || centers.include?(row.center_id(level)) || center_types.include?(row.center_type_id(level))) &&
            (currencies.empty? || currencies.include?(row.currency_id))
        end
      end

      # ── 2. grain groups and sign split ──────────────────────────────────

      def map_groups
        by_rule = Hash.new { |hash, key| hash[key] = [] }.compare_by_identity
        @row_rules.each { |row, rule| by_rule[rule] << row }
        resolution_by_row = @resolution_by_row

        by_rule.each do |rule, rule_rows|
          target = lines_by_key[rule.line_key]
          next errors << { type: "missing_line", line_key: rule.line_key } unless target

          rule_rows.group_by { |row| grain_key(rule.grain, row) }.each do |grain_key, group|
            total = group.sum(ZERO) { |row| row.value(rule.measure) }
            reclassified = rule.opposite_line_key.present? && opposite_side?(target, total)
            line_key = reclassified ? rule.opposite_line_key : rule.line_key
            line = lines_by_key[line_key]
            next errors << { type: "missing_line", line_key: line_key } unless line

            contributions << Contribution.new(line_key: line_key, rule_id: rule.id, grain_key: grain_key, rows: group,
                                              amount: on_side(line, total), reclassified: reclassified)
            group.each do |row|
              resolution = resolution_by_row.fetch(row)
              resolution.line_key = line_key
              resolution.reclassified = reclassified
              resolution.group_total = total
              resolution.amount = row.value(rule.measure)
            end
          end
        end
      end

      def grain_key(grain, row)
        case grain.to_s
        when "row" then row.key
        when "account_currency" then [ row.account_id, row.currency_id ]
        when /\Aaccount_center([1-6])\z/ then [ row.account_id, row.center_id(Regexp.last_match(1).to_i) ]
        else [ row.account_id ]
        end
      end

      # A debit-positive total on the side opposite to the line's normal side.
      def opposite_side?(line, total)
        line.normal_side.to_s == "credit" ? total.positive? : total.negative?
      end

      # ── 3. line values ─────────────────────────────────────────────────

      def compute_values
        @own = Hash.new(ZERO)
        contributions.each { |contribution| @own[contribution.line_key] += contribution.amount }
        @children = lines.group_by(&:parent_key)
        @state = {}
        lines.each { |line| value_of(line.key) }
      end

      def value_of(key)
        return values[key] if @state[key] == :done
        if @state[key] == :visiting
          errors << { type: "cycle", line_key: key }
          return nil
        end

        line = lines_by_key[key]
        return nil unless line

        @state[key] = :visiting
        values[key] = if @fixed_values.key?(key)
          @fixed_values[key]
        else
          case line.kind.to_s
          when "heading" then nil
          when "formula" then formula_value(line)
          else mapped_value(line)
          end
        end
        @state[key] = :done
        values[key]
      end

      def mapped_value(line)
        Array(@children[line.key]).reduce(@own[line.key]) do |total, child|
          child_value = value_of(child.key)
          next total if child_value.nil?

          child.normal_side.to_s == line.normal_side.to_s ? total + child_value : total - child_value
        end
      end

      def formula_value(line)
        variables = Formula.dependencies(line.formula).to_h do |dependency|
          errors << { type: "unknown_line", line_key: line.key, message: dependency } unless lines_by_key[dependency]
          [ dependency, value_of(dependency) || ZERO ]
        end
        Formula.evaluate(line.formula, variables)
      rescue Formula::Error => e
        errors << { type: "formula", line_key: line.key, message: e.message }
        nil
      end
    end
  end
end
