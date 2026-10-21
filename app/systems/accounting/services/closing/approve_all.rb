# app/systems/accounting/services/closing/approve_all.rb
module Accounting
  module Closing
    # Approves every booked entry of an open fiscal year, one by one through
    # the model so validations, locks and approval metadata apply. Entries
    # that can't be approved are reported and stay booked.
    class ApproveAll
      Result = Struct.new(:approved, :failed, keyword_init: true)

      BATCH_SIZE = 200

      def initialize(fiscal_year, member:)
        @fiscal_year = fiscal_year
        @member = member
      end

      def call
        raise Error.new(:not_open) unless fiscal_year.open?

        approved = 0
        failed = []
        fiscal_year.journal_entries.booked.includes(:items).find_each(batch_size: BATCH_SIZE) do |entry|
          if entry.approve(member)
            approved += 1
          else
            failed << { id: entry.id, no: entry.no, ref: entry.ref, date: entry.date, errors: entry.errors.full_messages }
          end
        end
        Result.new(approved: approved, failed: failed)
      end

      private

      attr_reader :fiscal_year, :member
    end
  end
end
