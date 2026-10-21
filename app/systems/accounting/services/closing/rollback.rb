# app/systems/accounting/services/closing/rollback.rb
module Accounting
  module Closing
    # Goes back one closing step, undoing what the previous step posted:
    #
    #   revaluation  → renumber      (numbers already changed stay)
    #   temp_closing → revaluation   (nothing was posted)
    #   ending       → temp_closing  (deletes the temporary closing entries)
    #   beginning    → ending        (deletes the ending entry)
    #   finalized    → beginning     (reopens a closed year: deletes the
    #                                 beginning entry of the next year)
    #
    # Going back from the renumber step is canceling (Canceler).
    # Rollback.reopen_fully! undoes the whole closing.
    class Rollback
      PREVIOUS_STEP = {
        "revaluation" => "renumber",
        "temp_closing" => "revaluation",
        "ending" => "temp_closing",
        "beginning" => "ending",
        "finalized" => "beginning"
      }.freeze

      # The closing_data key a step writes when it completes.
      STEP_DATA = {
        "renumber" => "renumber",
        "temp_closing" => "temp_closing",
        "ending" => "ending",
        "beginning" => "beginning"
      }.freeze

      # Every step back to an open year, in reverse order.
      def self.reopen_fully!(fiscal_year)
        FiscalYear.transaction do
          fiscal_year.lock!
          raise Error.new(:not_closing) if fiscal_year.open?

          new(fiscal_year).call while PREVIOUS_STEP.key?(current_step(fiscal_year))
          Canceler.new(fiscal_year).call
        end
        fiscal_year
      end

      def self.current_step(fiscal_year)
        fiscal_year.closed? ? "finalized" : fiscal_year.closing_step
      end

      def initialize(fiscal_year)
        @fiscal_year = fiscal_year
      end

      def call
        FiscalYear.transaction do
          fiscal_year.lock!
          raise Error.new(:not_closing) if fiscal_year.open?

          step = self.class.current_step(fiscal_year)
          previous = PREVIOUS_STEP[step]
          raise Error.new(:wrong_step) unless previous

          send(:"undo_#{previous}")
          fiscal_year.update!(status: :closing, closing_step: previous, closing_data: closing_data_without(previous),
                              closed_at: nil, closed_by: nil)
        end
        fiscal_year
      end

      private

      attr_reader :fiscal_year

      def closing_data_without(step)
        key = STEP_DATA[step]
        key ? fiscal_year.closing_data.except(key) : fiscal_year.closing_data
      end

      def undo_renumber; end

      def undo_revaluation; end

      def undo_temp_closing
        TempClosing.destroy_entries!(fiscal_year)
      end

      def undo_ending
        EndingEntry.destroy_entries!(fiscal_year)
      end

      # The next year's balances change when its beginning entry goes away.
      def undo_beginning
        blockers = reopen_blockers
        raise Error.new(:reopen_blocked, blockers: blockers) if blockers.any?

        BeginningEntry.destroy_entries!(fiscal_year)
      end

      def reopen_blockers
        next_year = fiscal_year.organization.fiscal_years.find_by(id: fiscal_year.closing_data.dig("beginning", "fiscal_year_id")) ||
                    fiscal_year.next_fiscal_year
        return [] if next_year.nil?

        blockers = []
        blockers << "next_fiscal_year_not_open" unless next_year.open?
        if Accounting::CurrencyRevaluation.exists?(fiscal_year: next_year, status: :posted, kind: :permanent)
          blockers << "next_year_permanent_revaluations"
        end
        blockers
      end
    end
  end
end
