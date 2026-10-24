module Accounting
  module Ratios
    # Report type "accounting.ratios": the ratio catalog over the
    # organization's primary statements (see Calculator).
    #
    # Run params: from, to (default: the fiscal year of today, up to
    # today), comparison, approved_only.
    module ReportType
      module_function
      def copy_content(_source, _copy); end

      def run(_report, organization:, params:, access:)
        last_finish = organization.fiscal_years.maximum(:finish_date)
        to = Accounting::Reports::RunParams.date(params, :to) || [ Date.current, last_finish ].compact.min
        fiscal_year = Accounting::Statements::Periods.fiscal_year_for(organization, to)
        from = Accounting::Reports::RunParams.date(params, :from) || fiscal_year&.start_date || to.beginning_of_year
        Calculator.new(
          organization: organization, access: access, from: from, to: to,
          comparison: Accounting::Reports::RunParams.comparison?(params),
          approved_only: Accounting::Reports::RunParams.approved_only?(params)
        ).call
      end

      # Data of the ratios print (Reports::FinancialRatiosTemplate): values
      # formatted as text, "n/a" when a ratio can't be computed.
      def print(report, organization:, params:, access:)
        payload = run(report, organization: organization, params: params, access: access)
        columns = payload[:columns]
        format = lambda do |ratio, key|
          next I18n.t("reports.financial_ratios.not_available") if ratio[:reasons][key]

          value = ratio[:values][key]
          next "" if value.nil?

          number = BigDecimal(value)
          case ratio[:format]
          when "percent" then ActiveSupport::NumberHelper.number_to_percentage(number * 100, precision: 1)
          when "days" then I18n.t("reports.financial_ratios.days", count: number.round.to_i)
          else ActiveSupport::NumberHelper.number_to_rounded(number, precision: 2)
          end
        end
        rows = payload[:ratios].map do |ratio|
          { group_name: I18n.t("reports.financial_ratios.groups.#{ratio[:group]}"), name: ratio[:name],
            current: format.call(ratio, "current"), previous: columns.size > 1 ? format.call(ratio, "previous") : "" }
        end
        title = ->(column) { Accounting::Reports::PrintHeader.column_title(column) }
        Accounting::Reports::PrintHeader.call(organization: organization, from: columns.first[:from], to: columns.first[:to],
                                              approved_only: Accounting::Reports::RunParams.approved_only?(params))
                                        .merge(comparison: columns.size > 1, period_text: title.call(columns.first),
                                               title_current: title.call(columns.first),
                                               title_previous: columns.size > 1 ? title.call(columns.last) : "", rows: rows)
      end

      def drill(*)
        raise ActiveRecord::RecordNotFound
      end
    end
  end
end
