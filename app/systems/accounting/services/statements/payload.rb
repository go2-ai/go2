module Accounting
  module Statements
    # JSON for a statement run and its drill-down. Amounts are decimal
    # strings rounded to the main currency's decimals, on each line's
    # normal side.
    class Payload
      def initialize(result, organization:)
        @result = result
        @organization = organization
      end

      def run
        {
          columns: result.columns.map { |column| column_json(column) },
          lines: lines_json,
          checks: result.checks.map(&:as_json),
          currency: currency_json,
          center_levels: center_levels
        }
      end

      # The balances behind one line, by account, or by the centers of one
      # level of one account. Only this line's own mapped amounts: child
      # lines are lines of their own.
      def contributions(line_key, account_id: nil, center_level: nil)
        line = result.layout.lines.find { |l| l.key == line_key } || raise(ActiveRecord::RecordNotFound)
        rows = {}
        result.columns.each do |column|
          engine = result.engine(column.key)
          engine.contributions_for(line_key).each do |contribution|
            contribution.rows.each do |row|
              next if account_id && row.account_id != account_id

              key = center_level ? [ row.center_id(center_level), row.period_key ] : [ row.account_id, row.period_key ]
              entry = rows[key] ||= { account_id: row.account_id, center_id: center_level && row.center_id(center_level),
                                      period: row.category_type == "income_statement" ? row.period : nil,
                                      values: {}, reclassified: false, rule_ids: Set.new, center_levels: Set.new }
              entry[:values][column.key] = (entry[:values][column.key] || 0) + engine.on_side(engine.line(line_key), row.value)
              entry[:reclassified] ||= contribution.reclassified
              entry[:rule_ids] << contribution.rule_id
              # The levels at which this account's balances have centers:
              # only those can be broken down further.
              (1..center_levels).each { |level| entry[:center_levels] << level if row.center_id(level) }
            end
          end
        end
        {
          line: { key: line.key, label: line.label, kind: line.kind, normal_side: line.normal_side },
          level: center_level ? "center" : "account",
          center_level: center_level,
          columns: result.columns.map { |column| column_json(column) },
          rows: describe(rows.values.reject { |entry| entry[:values].values.all?(&:zero?) }, center_level),
          currency: currency_json
        }
      end

      private

      attr_reader :result, :organization

      def lines_json
        layout_lines = result.layout.lines.to_a
        keys = layout_lines.to_h { |line| [ line.id, line.key ] }
        depth = {}
        own_lines = result.engines.values.flat_map(&:contributions).map(&:line_key).to_set
        layout_lines.map do |line|
          depth[line.id] = line.parent_id ? depth.fetch(line.parent_id, 0) + 1 : 0
          {
            key: line.key, parent_key: keys[line.parent_id], depth: depth[line.id], kind: line.kind,
            normal_side: line.normal_side, label: line.label, formula: line.formula, style: line.style,
            metadata: line.metadata, has_contributions: own_lines.include?(line.key),
            values: result.columns.to_h { |column| [ column.key, amount(result.value(column.key, line.key)) ] }
          }
        end
      end

      def describe(entries, center_level)
        accounts = Accounting::Account.includes(ledger: :account_category).where(id: entries.map { |e| e[:account_id] }.uniq).index_by(&:id)
        centers = Accounting::Center.where(id: entries.map { |e| e[:center_id] }.compact.uniq).index_by(&:id)
        entries.map do |entry|
          account = accounts[entry[:account_id]]
          center = centers[entry[:center_id]]
          {
            id: [ center_level ? "c#{entry[:center_id]}" : "a#{entry[:account_id]}", entry[:period] ].compact.join("-"),
            account_id: entry[:account_id], account_code: account&.full_code, account_name: account&.name,
            ledger_id: account&.ledger_id, category_identifier: account&.ledger&.account_category&.identifier,
            center_id: entry[:center_id], center_code: center&.code, center_name: center&.name,
            period: entry[:period], reclassified: entry[:reclassified], rule_ids: entry[:rule_ids].to_a,
            center_levels: entry[:center_levels].to_a.sort,
            values: result.columns.to_h { |column| [ column.key, amount(entry[:values][column.key]) ] }
          }
        end.sort_by { |row| [ row[:account_code].to_s, row[:center_code].to_s, row[:period].to_s ] }
      end

      # For each column, the journal entries behind its figures: the period
      # and entry types (prior: income statement balances before the fiscal
      # year of a balance sheet date).
      def column_json(column)
        json = column.as_json
        if column.as_of?
          first_start = Periods.first_start(organization)
          year = Periods.fiscal_year_for(organization, column.as_of)
          json[:entries] = { from: first_start&.iso8601, to: column.as_of.iso8601, entry_types: Periods::DEFAULT_TYPES }
          if year && first_start && year.start_date > first_start
            json[:entries_prior] = { from: first_start.iso8601, to: (year.start_date - 1).iso8601, entry_types: Periods::DEFAULT_TYPES }
            json[:entries_current] = { from: year.start_date.iso8601, to: column.as_of.iso8601, entry_types: Periods::REGULAR_TYPES }
          end
        else
          types = result.layout.statement_type == "cash_flow" ? Periods::CASH_FLOW_TYPES : Periods::DEFAULT_TYPES
          json[:entries] = { from: column.from.iso8601, to: column.to.iso8601, entry_types: types }
        end
        json
      end

      # Center levels the organization uses (accounting settings).
      def center_levels
        @center_levels ||= organization.center_levels
      end

      def money
        @money ||= Accounting::MoneyFormat.new(organization)
      end

      delegate :currency_json, :digits, :amount, to: :money, private: true
    end
  end
end
