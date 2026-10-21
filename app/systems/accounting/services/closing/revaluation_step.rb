# app/systems/accounting/services/closing/revaluation_step.rb
module Accounting
  module Closing
    # Actions of the revaluation step: acknowledge what remains and move on.
    class RevaluationStep
      def initialize(fiscal_year, member:)
        @fiscal_year = fiscal_year
        @member = member
      end

      # Accepts the current remaining differences / missing rates.
      def acknowledge!
        FiscalYear.transaction do
          fiscal_year.lock!
          ensure_step!
          check = RevaluationCheck.new(fiscal_year).call
          raise Error.new(:temporary_revaluations_remain) if check.temporaries.any?

          data = fiscal_year.closing_data.merge(
            "revaluation_acknowledgment" => {
              "checksum" => check.checksum,
              "member_id" => member&.id,
              "at" => Time.current.iso8601,
              "total_difference" => check.total_difference.to_s("F"),
              "missing_rates" => check.missing_rates.size
            }
          )
          fiscal_year.update!(closing_data: data)
        end
        fiscal_year
      end

      # revaluation → temp_closing, when the check passes.
      def complete!
        FiscalYear.transaction do
          fiscal_year.lock!
          ensure_step!
          check = RevaluationCheck.new(fiscal_year).call
          raise Error.new(:temporary_revaluations_remain) if check.temporaries.any?
          raise Error.new(:revaluation_incomplete) unless check.passes?

          fiscal_year.update!(closing_step: :temp_closing)
        end
        fiscal_year
      end

      private

      attr_reader :fiscal_year, :member

      def ensure_step!
        raise Error.new(:wrong_step) unless fiscal_year.closing? && fiscal_year.step_revaluation?
      end
    end
  end
end
