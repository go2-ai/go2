# app/systems/accounting/services/closing/readiness.rb
module Accounting
  module Closing
    # Whether a fiscal year can start closing. Checked while the year is
    # still open, because fixing the blockers (booking or deleting drafts,
    # approving entries) needs an open year.
    #
    # Blockers:
    #   drafts                     draft entries must be booked or deleted
    #   unapproved_entries         booked entries must be approved
    #   no_next_fiscal_year        the next year receives the beginning entry
    #   next_fiscal_year_not_open
    #   previous_fiscal_year_open  the previous year (if it has entries) must be closed first
    #   settings_incomplete        closing method accounts missing
    #   not_open                   the year is already closing or closed
    class Readiness
      Result = Struct.new(:blockers, :drafts_count, :booked_count, :approved_count,
                          :next_fiscal_year, :previous_fiscal_year, :settings_errors, keyword_init: true) do
        def ready?
          blockers.empty?
        end
      end

      def initialize(fiscal_year)
        @fiscal_year = fiscal_year
      end

      def call
        entries = fiscal_year.journal_entries
        counts = entries.group(:state).count
        next_year = fiscal_year.next_fiscal_year
        previous_year = fiscal_year.previous_fiscal_year
        settings_errors = organization.accounting_setting&.closing_configuration_errors || []

        blockers = []
        blockers << :not_open unless fiscal_year.open?
        blockers << :drafts if counts["draft"].to_i.positive?
        blockers << :unapproved_entries if counts["booked"].to_i.positive?
        blockers << :no_next_fiscal_year if next_year.nil?
        blockers << :next_fiscal_year_not_open if next_year && !next_year.open?
        blockers << :previous_fiscal_year_open if previous_year && !previous_year.closed? && previous_year.journal_entries.exists?
        blockers << :settings_incomplete if settings_errors.any?

        Result.new(
          blockers: blockers,
          drafts_count: counts["draft"].to_i,
          booked_count: counts["booked"].to_i,
          approved_count: counts["approved"].to_i,
          next_fiscal_year: next_year,
          previous_fiscal_year: previous_year,
          settings_errors: settings_errors
        )
      end

      private

      attr_reader :fiscal_year

      def organization
        fiscal_year.organization
      end
    end
  end
end
