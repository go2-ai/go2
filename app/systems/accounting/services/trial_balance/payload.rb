module Accounting
  module TrialBalance
    # JSON of a trial balance run. Amounts are decimal strings rounded to
    # the main currency's decimals; each pair shows one side only.
    class Payload
      def initialize(runner, lines, hide_zero: true)
        @runner = runner
        @lines = lines
        @hide_zero = hide_zero
      end

      def call
        rows = lines.map { |line| row_json(line) }
        rows = rows.reject { |row| row[:zero] } if hide_zero
        rows.sort_by! { |row| [ row[:prior_result] ? 1 : 0, row[:code].to_s, row[:center_code].to_s ] }
        totals = totals_json(lines)
        {
          from: runner.from.iso8601, to: runner.to.iso8601, level: runner.level, center_level: runner.center_level,
          entries: runner.selections,
          rows: rows.map { |row| row.except(:zero) },
          totals: totals,
          checks: checks(totals),
          currency: money.currency_json,
          center_levels: runner.organization.center_levels
        }
      end

      private

      attr_reader :runner, :lines, :hide_zero

      def row_json(line)
        record = records[line.level_id]
        center = centers[line.center_id]
        prior = line.level_id == Runner::PRIOR_RESULT_ID
        {
          id: [ line.level_id, line.center_id ].compact.join("-"),
          level: runner.level, level_id: prior ? nil : line.level_id, prior_result: prior,
          code: record && code_of(record), name: prior ? nil : record&.name,
          center_id: line.center_id, center_code: center&.code, center_name: center&.name,
          zero: [ line.opening, line.debit, line.credit, line.closing ].all?(&:zero?),
          **sides(:opening, line.opening),
          debit: amount(line.debit), credit: amount(line.credit),
          **sides(:closing, line.closing)
        }
      end

      def sides(prefix, balance)
        { "#{prefix}_debit": amount(balance.positive? ? balance : 0), "#{prefix}_credit": amount(balance.negative? ? -balance : 0) }
      end

      def totals_json(list)
        sum = ->(values) { values.sum(Runner::ZERO) }
        {
          opening_debit: amount(sum.call(list.map { |l| [ l.opening, 0 ].max })),
          opening_credit: amount(sum.call(list.map { |l| [ -l.opening, 0 ].max })),
          debit: amount(sum.call(list.map(&:debit))),
          credit: amount(sum.call(list.map(&:credit))),
          closing_debit: amount(sum.call(list.map { |l| [ l.closing, 0 ].max })),
          closing_credit: amount(sum.call(list.map { |l| [ -l.closing, 0 ].max }))
        }
      end

      def checks(totals)
        %w[opening period closing].filter_map do |name|
          debit, credit = name == "period" ? [ totals[:debit], totals[:credit] ] : [ totals[:"#{name}_debit"], totals[:"#{name}_credit"] ]
          difference = BigDecimal(debit) - BigDecimal(credit)
          next if difference.abs < money.tolerance

          { severity: "error", code: "trial_balance_unbalanced", column: name, details: { difference: amount(difference) } }
        end
      end

      def records
        @records ||= begin
          ids = lines.map(&:level_id).reject { |id| id == Runner::PRIOR_RESULT_ID }.uniq
          scope = case runner.level
          when "category" then Accounting::AccountCategory.where(id: ids)
          when "ledger" then Accounting::Ledger.includes(:account_category).where(id: ids)
          else Accounting::Account.includes(ledger: :account_category).where(id: ids)
          end
          scope.index_by(&:id)
        end
      end

      def code_of(record)
        record.respond_to?(:full_code) ? record.full_code : record.code
      end

      def centers
        @centers ||= Accounting::Center.where(id: lines.map(&:center_id).compact.uniq).index_by(&:id)
      end

      def money
        @money ||= Accounting::MoneyFormat.new(runner.organization)
      end

      delegate :digits, :amount, to: :money, private: true
    end
  end
end
