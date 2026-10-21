# app/systems/accounting/services/closing/starter.rb
module Accounting
  module Closing
    # Starts closing a fiscal year once Readiness passes: the year becomes
    # `closing` (users can't change its entries anymore, so balances don't
    # move between steps) and the closing settings are snapshotted, so later
    # settings changes don't affect this closing.
    class Starter
      SYSTEM_CONTEXT = :fiscal_year_closing

      def initialize(fiscal_year, member:)
        @fiscal_year = fiscal_year
        @member = member
      end

      def call
        FiscalYear.transaction do
          fiscal_year.lock!
          readiness = Readiness.new(fiscal_year).call
          raise Error.new(:not_ready, blockers: readiness.blockers) unless readiness.ready?

          fiscal_year.update!(
            status: :closing,
            closing_step: :renumber,
            closing_started_at: Time.current,
            closing_started_by: member,
            closing_data: {
              "settings" => fiscal_year.organization.accounting_setting.closing_snapshot,
              "next_fiscal_year_id" => readiness.next_fiscal_year.id
            }
          )
        end
        fiscal_year
      end

      private

      attr_reader :fiscal_year, :member
    end
  end
end
