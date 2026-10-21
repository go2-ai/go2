# app/systems/accounting/services/closing/revaluation_check.rb
module Accounting
  module Closing
    # Step 2: year-end foreign currency balances must be final before
    # temporary accounts are closed (FX results are income statement items).
    #
    # - No temporary revaluation may remain in the year: convert the latest
    #   to permanent or remove it.
    # - A permanent revaluation as of the year's last day should leave no
    #   difference. A dry run (Revaluation::Builder, permanent, all monetary
    #   balances) shows what would still be posted and which balances have
    #   no rate.
    # - Remaining differences or missing rates can be acknowledged; the
    #   acknowledgment is tied to the dry run's checksum, so it lapses when
    #   balances or rates change.
    class RevaluationCheck
      Result = Struct.new(:temporaries, :unrevalued, :missing_rates, :other_exclusions, :checksum,
                          :acknowledged, :as_of_date, keyword_init: true) do
        def clean?
          unrevalued.empty? && missing_rates.empty? && other_exclusions.empty?
        end

        def passes?
          temporaries.empty? && (clean? || acknowledged)
        end

        def total_difference
          unrevalued.sum(BigDecimal("0")) { |item| item[:difference] }
        end
      end

      def initialize(fiscal_year)
        @fiscal_year = fiscal_year
      end

      def call
        result = Accounting::Revaluation::Builder.new(
          organization: fiscal_year.organization, as_of_date: fiscal_year.finish_date,
          scope: {}, kind: :permanent
        ).call

        items = result.items
        Result.new(
          temporaries: temporaries,
          unrevalued: items.reject { |item| item[:excluded] || item[:difference].zero? },
          missing_rates: items.select { |item| item[:excluded_reason] == "missing_rate" },
          other_exclusions: items.select do |item|
            item[:excluded] && !%w[missing_rate locked_by_permanent].include?(item[:excluded_reason])
          end,
          checksum: result.checksum,
          acknowledged: acknowledgment_checksum.present? && acknowledgment_checksum == result.checksum,
          as_of_date: fiscal_year.finish_date
        )
      end

      private

      attr_reader :fiscal_year

      def temporaries
        Accounting::CurrencyRevaluation.where(fiscal_year: fiscal_year, status: :posted, kind: :temporary)
                                       .includes(:items, :journal_entry).order(:as_of_date, :id).to_a
      end

      def acknowledgment_checksum
        fiscal_year.closing_data.dig("revaluation_acknowledgment", "checksum")
      end
    end
  end
end
