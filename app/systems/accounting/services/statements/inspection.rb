module Accounting
  module Statements
    # The mapping inspection list: every balance a statement column reads,
    # at the Balances::Query grain (account × centers × currency), with the
    # line it is reflected in and the rule that decided it.
    #
    # With `proposed_rules` (Engine::Rule structs) each row also shows where
    # it would go under those rules, so a change can be reviewed before it
    # is saved.
    class Inspection
      def initialize(report:, organization:, column:, approved_only: false, proposed_rules: nil)
        @report = report
        @organization = organization
        @column = column
        @approved_only = approved_only
        @proposed_rules = proposed_rules
      end

      def call
        current = run(nil)
        proposed = proposed_rules && run(proposed_rules)
        engine = current.engine(column.key)
        proposed_by_row = proposed ? proposed.engine(column.key).resolutions.index_by { |r| r.row.key } : {}
        rule_labels = rule_numbers
        other = current.other_rows.fetch(column.key, []).reject { |row| row.value.zero? }
        @all_rows = engine.resolutions.map(&:row) + other

        rows = engine.resolutions.map do |resolution|
          row_json(resolution.row, resolution, proposed_by_row[resolution.row.key], rule_labels)
        end
        rows += other.map { |row| row_json(row, nil, nil, rule_labels).merge(out_of_scope: true) }

        {
          column: column.as_json,
          center_levels: center_levels,
          rows: rows.sort_by { |row| [ row[:account_code].to_s, row[:center_codes].to_s, row[:currency].to_s ] },
          checks: current.checks.select { |check| check.column == column.key }.map(&:as_json),
          proposed_checks: proposed&.checks&.select { |check| check.column == column.key }&.map(&:as_json),
          currency: { decimal_digits: digits }
        }
      end

      private

      attr_reader :report, :organization, :column, :approved_only, :proposed_rules

      def run(rules)
        Runner.new(report: report, organization: organization, columns: [ column ], approved_only: approved_only,
                   rules: rules).call
      end

      def layout
        report.statement_layout
      end

      def lines
        @lines ||= layout.lines.index_by(&:key)
      end

      # Rules are shown by their position number ("Rule 3").
      def rule_numbers
        layout.rules.each_with_index.to_h { |rule, index| [ rule.id, index + 1 ] }
      end

      def row_json(row, resolution, proposed, rule_numbers)
        account = accounts[row.account_id]
        line_key = resolution&.line_key
        {
          id: row.key.join("-"),
          account_id: row.account_id,
          account_code: account&.full_code,
          account_name: account&.name,
          ledger_id: account&.ledger_id,
          ledger_code: account&.ledger&.full_code,
          ledger_name: account&.ledger&.name,
          category_identifier: row.category_identifier,
          category_name: account&.ledger&.account_category&.name,
          centers: (1..center_levels).map do |level|
            center = centers[row.center_id(level)]
            center && { id: center.id, code: center.code, name: center.name }
          end,
          center_codes: (1..center_levels).map { |level| centers[row.center_id(level)]&.code }.join("|"),
          currency_id: row.currency_id,
          currency: currencies[row.currency_id],
          period: row.category_type == "income_statement" ? row.period : nil,
          balance: amount(row.value),
          line_key: line_key,
          line_label: line_key && lines[line_key]&.label,
          rule_id: resolution&.rule_id,
          rule_number: resolution && rule_numbers[resolution.rule_id],
          overridden_rule_ids: resolution&.overridden_rule_ids || [],
          overridden_rule_numbers: (resolution&.overridden_rule_ids || []).map { |id| rule_numbers[id] }.compact,
          conflicting_rule_ids: resolution&.conflicting_rule_ids || [],
          reclassified: resolution&.reclassified || false,
          group_total: resolution&.group_total && amount(resolution.group_total),
          unmapped: resolution.present? && resolution.rule_id.nil?,
          out_of_scope: false
        }.tap do |json|
          next unless proposed_rules

          json[:proposed_line_key] = proposed&.line_key
          json[:proposed_line_label] = proposed&.line_key && lines[proposed.line_key]&.label
          json[:proposed_rule_id] = proposed&.rule_id
          json[:proposed_reclassified] = proposed&.reclassified || false
          json[:changed] = resolution.present? && (proposed&.line_key != line_key)
        end
      end

      attr_reader :all_rows

      def accounts
        @accounts ||= Accounting::Account.includes(ledger: :account_category).where(id: all_rows.map(&:account_id).uniq)
                                         .index_by(&:id)
      end

      def centers
        @centers ||= Accounting::Center.where(id: all_rows.flat_map(&:center_ids).compact.uniq).index_by(&:id)
      end

      def currencies
        @currencies ||= organization.currencies.pluck(:id, :abr).to_h
      end

      def center_levels
        @center_levels ||= organization.center_levels
      end

      def money
        @money ||= Accounting::MoneyFormat.new(organization)
      end

      delegate :digits, :amount, to: :money, private: true
    end
  end
end
