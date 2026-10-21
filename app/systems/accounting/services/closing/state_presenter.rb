# app/systems/accounting/services/closing/state_presenter.rb
module Accounting
  module Closing
    # JSON for the closing wizard: the fiscal year's closing state, the
    # readiness checks (while open) and the generated entries.
    class StatePresenter
      STEPS = %w[readiness renumber revaluation temp_closing ending beginning finalized].freeze

      # step_error: why the current step's preview couldn't be built.
      def initialize(fiscal_year, readiness: nil, revaluation_check: nil, temp_closing: nil, ending: nil, beginning: nil,
                     renumber: nil, step_error: nil)
        @fiscal_year = fiscal_year
        @step_error = step_error
        @readiness = readiness
        @revaluation_check = revaluation_check
        @temp_closing = temp_closing
        @ending = ending
        @beginning = beginning
        @renumber = renumber
      end

      def as_json(*)
        {
          fiscal_year: fiscal_year_json(fiscal_year),
          steps: STEPS,
          current_step: current_step,
          settings: settings,
          readiness: readiness && readiness_json,
          revaluation_check: revaluation_check && revaluation_check_json,
          temp_closing: temp_closing && temp_closing_json,
          ending: ending && ending_json,
          beginning: beginning && beginning_json,
          renumber: renumber && renumber_json,
          step_error: step_error,
          line_templates: line_templates_json,
          next_fiscal_year: fiscal_year_json(next_fiscal_year),
          summary: fiscal_year.closed? ? summary_json : nil,
          entries: closing_entries_json
        }
      end

      private

      attr_reader :fiscal_year, :readiness, :revaluation_check, :temp_closing, :ending, :beginning, :renumber, :step_error

      # The year receiving the beginning entry (chosen when closing started).
      def next_fiscal_year
        fiscal_year.closing_next_fiscal_year
      end

      def renumber_json
        {
          entries_count: renumber.entries_count,
          changed_count: renumber.changes.size,
          changes: renumber.changes.first(Renumberer::PREVIEW_LIMIT).map(&:to_h)
        }
      end

      # own: this closing's templates ({ kind => { locale => text } });
      # defaults: what blank locales use.
      def line_templates_json
        {
          own: fiscal_year.closing_data["line_templates"] || {},
          defaults: LineDescriptions.defaults(fiscal_year.organization)
        }
      end

      def beginning_json
        plan = beginning
        {
          next_fiscal_year: fiscal_year_json(plan.next_fiscal_year),
          date: plan.next_fiscal_year&.start_date,
          postable: plan.postable?,
          blockers: plan.blockers,
          total: plan.total.to_s("F"),
          lines: plan.lines.map { |line| line_json(line) },
          manual_beginning_entries: plan.manual_beginning_entries.map do |entry|
            { id: entry.id, no: entry.no, ref: entry.ref, date: entry.date }
          end,
          permanent_revaluations: plan.permanent_revaluations.map do |revaluation|
            { id: revaluation.id, as_of_date: revaluation.as_of_date }
          end
        }
      end

      def summary_json
        data = fiscal_year.closing_data
        {
          closed_at: fiscal_year.closed_at&.iso8601,
          closed_by_name: fiscal_year.closed_by&.name,
          closing_method: data.dig("settings", "closing_method"),
          net_result: data.dig("temp_closing", "net_result"),
          next_fiscal_year_id: data.dig("beginning", "fiscal_year_id")
        }
      end

      def ending_json
        {
          checksum: ending.checksum,
          postable: ending.postable?,
          balanced: ending.balanced?,
          total: ending.total.to_s("F"),
          open_temporary: ending.open_temporary,
          lines: ending.lines.map { |line| line_json(line) }
        }
      end

      def temp_closing_json
        plan = temp_closing
        {
          closing_method: plan.closing_method,
          net_result: plan.net_result.to_s("F"),
          checksum: plan.checksum,
          postable: plan.postable?,
          entries: plan.entries.map do |entry|
            {
              kind: entry.kind,
              target_account_id: entry.target_account_id,
              total: entry.total.to_s("F"),
              lines: entry.lines.map { |line| line_json(line) }
            }
          end,
          problems: plan.problems
        }
      end

      def line_json(line)
        {
          account_id: line[:account_id],
          currency_id: line[:currency_id],
          center_ids: (1..6).map { |level| line[:"center#{level}_id"] },
          debit: decimal(line[:debit]),
          credit: decimal(line[:credit]),
          currency_amount: decimal(line[:currency_amount]),
          rate: decimal(line[:rate])
        }
      end

      def revaluation_check_json
        check = revaluation_check
        {
          as_of_date: check.as_of_date,
          passes: check.passes?,
          clean: check.clean?,
          acknowledged: check.acknowledged,
          acknowledgment: fiscal_year.closing_data["revaluation_acknowledgment"],
          total_difference: check.total_difference.to_s("F"),
          temporaries: check.temporaries.map do |revaluation|
            {
              id: revaluation.id, as_of_date: revaluation.as_of_date,
              journal_entry_id: revaluation.journal_entry&.id, journal_entry_no: revaluation.journal_entry&.no,
              journal_entry_ref: revaluation.journal_entry&.ref,
              total_difference: revaluation.items.reject(&:excluded?).sum(BigDecimal("0"), &:difference).to_s("F")
            }
          end,
          unrevalued: check.unrevalued.map { |item| item_json(item) },
          missing_rates: check.missing_rates.map { |item| item_json(item) },
          other_exclusions: check.other_exclusions.map { |item| item_json(item) }
        }
      end

      def item_json(item)
        {
          account_id: item[:account_id],
          currency_id: item[:currency_id],
          center_ids: (1..6).map { |level| item[:"center#{level}_id"] },
          currency_balance: decimal(item[:currency_balance]),
          book_base_balance: decimal(item[:book_base_balance]),
          rate: decimal(item[:rate]),
          revalued_base_balance: decimal(item[:revalued_base_balance]),
          difference: decimal(item[:difference]),
          excluded_reason: item[:excluded_reason]
        }
      end

      def decimal(value)
        value.nil? ? nil : BigDecimal(value.to_s).to_s("F")
      end

      def current_step
        return "readiness" if fiscal_year.open?
        return "finalized" if fiscal_year.closed?

        fiscal_year.closing_step || "readiness"
      end

      # The snapshot while closing; the current settings while open.
      def settings
        snapshot = fiscal_year.closing_data["settings"]
        snapshot.presence || fiscal_year.organization.accounting_setting&.closing_snapshot
      end

      def fiscal_year_json(year)
        return nil unless year

        {
          id: year.id, name: year.name, start_date: year.start_date, finish_date: year.finish_date,
          status: year.status, closing_step: year.closing_step,
          closing_started_at: year.closing_started_at, closing_started_by_id: year.closing_started_by_id,
          closed_at: year.closed_at, closed_by_id: year.closed_by_id
        }
      end

      def readiness_json
        {
          ready: readiness.ready?,
          blockers: readiness.blockers,
          drafts_count: readiness.drafts_count,
          booked_count: readiness.booked_count,
          approved_count: readiness.approved_count,
          next_fiscal_year: fiscal_year_json(readiness.next_fiscal_year),
          previous_fiscal_year: fiscal_year_json(readiness.previous_fiscal_year),
          settings_errors: readiness.settings_errors
        }
      end

      def closing_entries_json
        fiscal_year.closing_entries.order(:date, :id).map do |entry|
          { id: entry.id, no: entry.no, ref: entry.ref, date: entry.date, entry_type: entry.entry_type,
            fiscal_year_id: entry.fiscal_year_id, debit: entry.debit.to_s("F") }
        end
      end
    end
  end
end
