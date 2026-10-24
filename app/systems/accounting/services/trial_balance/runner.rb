module Accounting
  module TrialBalance
    # Six-column trial balance for a period: opening, period movements and
    # closing, as debit and credit balances, at category, ledger or account
    # level, optionally split by the centers of one level.
    #
    # Year-end entries (temporary closing, ending) and the beginning entries
    # of later years are left out, as in the statements, so the result is
    # the same whether or not years are closed:
    #   - balance sheet accounts open with everything posted before `from`
    #     (the first fiscal year's beginning entries included);
    #   - income statement accounts open with what was posted in the fiscal
    #     year of `from` before it; the results of earlier years show on a
    #     separate "prior years' result" row.
    class Runner
      LEVELS = %w[category ledger account].freeze
      DEFAULT_TYPES = Accounting::Statements::Periods::DEFAULT_TYPES
      REGULAR_TYPES = Accounting::Statements::Periods::REGULAR_TYPES
      PRIOR_RESULT_ID = "prior_result".freeze
      ZERO = BigDecimal("0")

      Line = Struct.new(:key, :level_id, :center_id, :opening, :debit, :credit, keyword_init: true) do
        def closing
          opening + debit - credit
        end
      end

      attr_reader :organization, :from, :to, :level, :center_level, :approved_only

      def initialize(organization:, from:, to:, level: "account", center_level: nil, approved_only: false)
        @organization = organization
        @from = from
        @to = to
        @level = LEVELS.include?(level.to_s) ? level.to_s : "account"
        @center_level = center_level.presence&.to_i&.clamp(1, 6)
        @approved_only = approved_only
      end

      def fiscal_year
        @fiscal_year ||= Accounting::Statements::Periods.fiscal_year_for(organization, from)
      end

      def first_start
        @first_start ||= Accounting::Statements::Periods.first_start(organization)
      end

      # Lines keyed by [level id, center id]; the prior years' result line has level id PRIOR_RESULT_ID.
      def call
        raise Accounting::Explorer::InvalidScopeError.new(:fiscal_year_required) unless fiscal_year && first_start

        lines = Hash.new { |hash, key| hash[key] = Line.new(key: key, level_id: key[0], center_id: key[1], opening: ZERO, debit: ZERO, credit: ZERO) }
        prior_result = ZERO

        opening_rows.each do |row|
          if row[:category_type] == "income_statement" && row[:date_before_year]
            prior_result += row[:balance]
          else
            lines[key_for(row)].opening += row[:balance]
          end
        end
        period_rows.each do |row|
          line = lines[key_for(row)]
          line.debit += row[:debit]
          line.credit += row[:credit]
        end
        unless prior_result.zero?
          lines[[ PRIOR_RESULT_ID, nil ]].opening += prior_result
        end
        lines.values
      end

      # The journal entries behind the opening and period columns (for drill-down).
      def selections
        {
          opening: from > first_start ? { from: first_start.iso8601, to: (from - 1).iso8601, entry_types: DEFAULT_TYPES } : nil,
          period: { from: from.iso8601, to: to.iso8601, entry_types: REGULAR_TYPES }
        }
      end

      def accounts
        @accounts ||= Accounting::AccountReferences.new
      end

      private

      def scope(range_from, range_to, types)
        Accounting::Statements::Periods.entry_scope(organization, range_from, range_to, types, approved_only: approved_only)
      end

      def balances(entry_scope)
        rows = Accounting::Balances::Query.new(organization: organization, entry_scope: entry_scope).call
        accounts.load(rows.map(&:account_id))
        rows.filter_map do |row|
          account = accounts[row.account_id]
          next unless account

          { account_id: row.account_id, center_id: center_level && row.center_id(center_level),
            category_type: account[:category_type], debit: row.debit, credit: row.credit, balance: row.base_balance }
        end
      end

      def opening_rows
        rows = []
        if from > first_start
          before_year = fiscal_year.start_date > first_start ? fiscal_year.start_date - 1 : nil
          if before_year
            # Everything before the fiscal year of `from`.
            rows += balances(scope(first_start, before_year, DEFAULT_TYPES)).map { |row| row.merge(date_before_year: true) }
          end
          if from > fiscal_year.start_date
            types = fiscal_year.start_date == first_start ? DEFAULT_TYPES : REGULAR_TYPES
            rows += balances(scope(fiscal_year.start_date, from - 1, types)).map { |row| row.merge(date_before_year: false) }
          end
        end
        # The first fiscal year's beginning entries open the trial balance
        # when the period starts with it.
        if from == first_start
          rows += balances(scope(from, to, %w[beginning])).map { |row| row.merge(date_before_year: false) }
        end
        # Balance sheet accounts carry everything; only income statement
        # rows before the year are the prior years' result.
        rows.map { |row| row[:category_type] == "income_statement" ? row : row.merge(date_before_year: false) }
      end

      def period_rows
        balances(scope(from, to, REGULAR_TYPES))
      end

      def key_for(row)
        account = accounts.fetch(row[:account_id])
        id = case level
        when "category" then account[:category_id]
        when "ledger" then account[:ledger_id]
        else row[:account_id]
        end
        [ id, row[:center_id] ]
      end
    end
  end
end
