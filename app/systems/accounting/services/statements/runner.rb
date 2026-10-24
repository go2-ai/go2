module Accounting
  module Statements
    # Runs a statement report for one or more columns.
    #
    # Balance sheet columns are "as of" a date: they accumulate every entry
    # from the first fiscal year's start (the multi-year EntryScope drops
    # year-end and later beginning entries), so the result is the same
    # whether or not earlier years are closed. Income statement balances
    # posted before the fiscal year of the date are marked "prior" and
    # those within it "current", so profit_or_loss rules can send them to
    # retained earnings and profit for the year.
    #
    # Income statement columns cover a period (from..to).
    #
    #   Runner.new(report: report, columns: Runner.default_columns(report, date: Date.today)).call
    #
    # Column filters are Balances::Query filters (e.g. center1_ids:), for
    # dimension columns; the UI doesn't offer them yet.
    class Runner
      Column = Struct.new(:key, :as_of, :from, :to, :filters, keyword_init: true) do
        def as_of?
          as_of.present?
        end

        def as_json(*)
          { key: key, as_of: as_of&.iso8601, from: from&.iso8601, to: to&.iso8601 }.compact
        end
      end

      # severity: error | warning | info
      Check = Struct.new(:severity, :code, :column, :details, keyword_init: true) do
        def as_json(*)
          { severity: severity, code: code, column: column, details: details }
        end
      end

      # other_rows: column key => rows outside the layout's category types
      Result = Struct.new(:report, :layout, :columns, :engines, :checks, :other_rows, keyword_init: true) do
        def engine(column_key)
          engines.fetch(column_key)
        end

        def value(column_key, line_key)
          engine(column_key).values[line_key]
        end
      end

      REGULAR_TYPES = Periods::REGULAR_TYPES
      CASH_FLOW_TYPES = Periods::CASH_FLOW_TYPES
      DEFAULT_TYPES = Periods::DEFAULT_TYPES
      # Current column and, when `comparison`, the same dates one year
      # earlier (left out when outside the fiscal years).
      # System reports run for the organization given.
      def self.default_columns(report, organization: report.organization, date: nil, from: nil, to: nil,
                               comparison: true)
        columns = if report.statement_type == "balance_sheet"
          # Today, kept within the fiscal years.
          last_finish = organization&.fiscal_years&.maximum(:finish_date)
          as_of = date || to || [ Date.current, last_finish ].compact.min
          [ Column.new(key: "current", as_of: as_of) ]
        else
          fiscal_year = Periods.fiscal_year_for(organization, to || date || Date.current)
          period_to = to || date || [ fiscal_year&.finish_date, Date.current ].compact.min
          period_from = from || fiscal_year&.start_date || period_to.beginning_of_year
          [ Column.new(key: "current", from: period_from, to: period_to) ]
        end
        return columns unless comparison

        current = columns.first
        previous = if current.as_of?
          Column.new(key: "previous", as_of: current.as_of.prev_year)
        else
          Column.new(key: "previous", from: current.from.prev_year, to: current.to.prev_year)
        end
        start = previous.as_of? ? previous.as_of : previous.from
        finish = previous.as_of? ? previous.as_of : previous.to
        Periods.within_fiscal_years?(organization, start, finish) ? columns << previous : columns
      end

      # rules: Engine::Rule structs replacing the layout's rules (previews).
      def initialize(report:, columns:, organization: report.organization, approved_only: false, layout: nil,
                     rules: nil)
        @report = report
        @rules = rules
        @organization = organization || raise(ArgumentError, "a system report runs for an organization")
        if report.organization_id && report.organization_id != organization.id
          raise ArgumentError, "report belongs to another organization"
        end
        @layout = layout || report.statement_layout
        @columns = columns
        @approved_only = approved_only
      end

      def call
        checks = []
        other = {}
        engines = columns.to_h do |column|
          rows, other_rows = partition(rows_for(column))
          fixed = cash_flow? ? cash_values(column) : {}
          engine = Engine.from_layout(layout, rows: rows, setting_accounts: setting_accounts, rules: @rules,
                                      fixed_values: fixed).call
          checks.concat(column_checks(column, engine, other_rows))
          other[column.key] = other_rows
          [ column.key, engine ]
        end
        Result.new(report: report, layout: layout, columns: columns, engines: engines, checks: checks, other_rows: other)
      end

      # Rows a column reads; also used by the inspection list.
      def rows_for(column)
        source = RowSource.new(organization: organization, filters: column.filters || {})
        # Cash flows: the period's movements. Opening entries aren't flows
        # and revaluations aren't cash: they are added separately.
        return source.rows(scope(column.from, column.to, CASH_FLOW_TYPES)) if cash_flow? && !column.as_of?
        return source.rows(scope(column.from, column.to, DEFAULT_TYPES)) unless column.as_of?

        year = Periods.fiscal_year_for(organization, column.as_of)
        raise Accounting::Explorer::InvalidScopeError.new(:fiscal_year_required) unless first_start && year

        if year.start_date > first_start
          prior = source.rows(scope(first_start, year.start_date - 1, DEFAULT_TYPES), period: "prior")
          current = source.rows(scope(year.start_date, column.as_of, REGULAR_TYPES), period: "current")
        else
          prior = []
          current = source.rows(scope(year.start_date, column.as_of, DEFAULT_TYPES), period: "current")
        end
        merge_permanent(prior + current)
      end

      private

      attr_reader :report, :organization, :layout, :columns, :approved_only

      def cash_flow?
        layout.statement_type == "cash_flow" && layout.settings["cash_flow"].is_a?(Hash)
      end

      def cash_settings
        layout.settings["cash_flow"]
      end

      # Cash at the beginning and end of the period and the effect of
      # exchange rate changes (revaluations of cash), from the balances the
      # cash line's rules select. Amounts on each line's side.
      def cash_values(column)
        source = RowSource.new(organization: organization, filters: column.filters || {})
        opening_rows = if first_start && column.from > first_start
          rows_for(Column.new(key: column.key, as_of: column.from - 1, filters: column.filters))
        else
          source.rows(scope(column.from, column.to, %w[beginning]))
        end
        amounts = {
          cash_settings["opening_line"] => cash_total(opening_rows),
          cash_settings["closing_line"] => cash_total(rows_for(Column.new(key: column.key, as_of: column.to, filters: column.filters))),
          cash_settings["fx_line"] => cash_total(source.rows(scope(column.from, column.to, %w[revaluation])))
        }.compact
        lines = layout.lines.index_by(&:key)
        amounts.each_with_object({}) do |(key, amount), fixed|
          line = lines[key.to_s]
          fixed[key.to_s] = line&.normal_credit? ? -amount : amount if line
        end
      end

      # Debit-positive total of the rows the layout maps to the cash line.
      def cash_total(rows)
        engine = Engine.from_layout(layout, rows: rows, setting_accounts: setting_accounts, rules: @rules).call
        engine.resolutions.select { |resolution| resolution.line_key == cash_settings["cash_line"] }
              .sum(BigDecimal("0")) { |resolution| resolution.row.value }
      end

      def scope(from, to, types)
        Periods.entry_scope(organization, from, to, types, approved_only: approved_only)
      end

      # Balance sheet and other rows of the two ranges are one balance.
      def merge_permanent(rows)
        income, permanent = rows.partition { |row| row.category_type == "income_statement" }
        merged = permanent.group_by(&:key).map do |_key, list|
          list.first.dup.tap do |row|
            row.values = list.map(&:values).reduce { |a, b| a.merge(b) { |_, x, y| x + y } }
            row.period = "current"
          end
        end
        merged + income
      end

      def partition(rows)
        types = layout.category_types
        rows.partition { |row| types.include?(row.category_type) }
      end

      def setting_accounts
        @setting_accounts ||= Periods.setting_accounts(organization)
      end

      def first_start
        @first_start ||= Periods.first_start(organization)
      end

      def tolerance
        @tolerance ||= Accounting::MoneyFormat.new(organization).tolerance
      end

      def column_checks(column, engine, other_rows)
        checks = []
        if engine.unmapped.any?
          checks << Check.new(severity: "error", code: "unmapped", column: column.key,
                              details: { count: engine.unmapped.size,
                                         amount: engine.unmapped.sum(BigDecimal("0"), &:amount).to_s("F") })
        end
        engine.conflicts.each do |conflict|
          checks << Check.new(severity: "error", code: "rule_conflict", column: column.key, details: conflict)
        end
        engine.errors.uniq.each do |error|
          checks << Check.new(severity: "error", code: "line_#{error[:type]}", column: column.key, details: error)
        end
        layout.checks.each do |check|
          next unless check["type"] == "equal"

          left = engine.values[check["left"]] || 0
          right = if check["right_formula"]
            variables = Formula.dependencies(check["right_formula"]).to_h { |key| [ key, engine.values[key] || 0 ] }
            begin
              Formula.evaluate(check["right_formula"], variables)
            rescue Formula::Error
              0
            end
          else
            engine.values[check["right"]] || 0
          end
          next if (left - right).abs <= tolerance

          checks << Check.new(severity: "error", code: "not_balanced", column: column.key,
                              details: { left: check["left"], right: check["right"] || check["right_formula"],
                                         difference: (left - right).to_s("F") })
        end
        if cash_flow? && engine.contributions.none? { |contribution| contribution.line_key == cash_settings["cash_line"] }
          checks << Check.new(severity: "warning", code: "cash_not_mapped", column: column.key, details: {})
        end
        other = other_rows.reject { |row| row.value.zero? }
        if other.any?
          checks << Check.new(severity: "warning", code: "other_balances", column: column.key,
                              details: { count: other.size })
        end
        drafts = draft_count(column)
        checks << Check.new(severity: "warning", code: "draft_entries", column: column.key, details: { count: drafts }) if drafts.positive?
        unless approved_only
          booked = state_count(column, :booked)
          checks << Check.new(severity: "info", code: "unapproved_entries", column: column.key, details: { count: booked }) if booked.positive?
        end
        year = Periods.fiscal_year_for(organization, column.as_of || column.to)
        checks << Check.new(severity: "info", code: "fiscal_year_open", column: column.key, details: {}) if year && !year.closed?
        checks
      end

      def draft_count(column)
        state_count(column, :draft)
      end

      def state_count(column, state)
        from = column.as_of? ? first_start : column.from
        to = column.as_of || column.to
        organization.journal_entries.where(state: state, date: from..to).count
      end
    end
  end
end
