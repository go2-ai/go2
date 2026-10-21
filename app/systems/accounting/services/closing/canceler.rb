# app/systems/accounting/services/closing/canceler.rb
module Accounting
  module Closing
    # Cancels a closing while no closing entry exists (at any step): the
    # year is open again. Revaluations posted meanwhile are kept (they
    # belong to the revaluation tool, not to the closing).
    class Canceler
      def initialize(fiscal_year)
        @fiscal_year = fiscal_year
      end

      def call
        FiscalYear.transaction do
          fiscal_year.lock!
          raise Error.new(:not_closing) unless fiscal_year.closing?
          raise Error.new(:roll_back_first) if fiscal_year.closing_entries.exists?

          fiscal_year.update!(status: :open, closing_step: nil, closing_data: {},
                              closing_started_at: nil, closing_started_by: nil)
        end
        fiscal_year
      end

      private

      attr_reader :fiscal_year
    end
  end
end
