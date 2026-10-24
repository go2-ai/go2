module Accounting
  module TrialBalance
    # Report type "accounting.trial_balance". Its options (default level,
    # centers) live in the report's settings, so copying the report copies
    # everything.
    #
    # Run params: from, to (default: the fiscal year of today up to today),
    # level (category | ledger | account), center_level, hide_zero,
    # approved_only.
    module ReportType
      module_function
      def copy_content(_source, _copy); end

      def run(report, organization:, params:, access: nil)
        settings = report.settings.to_h
        fiscal_year = Accounting::Statements::Periods.fiscal_year_for(organization, Date.current)
        to = Accounting::Reports::RunParams.date(params, :to) || [ fiscal_year&.finish_date, Date.current ].compact.min
        from = Accounting::Reports::RunParams.date(params, :from) || Accounting::Statements::Periods.fiscal_year_for(organization, to)&.start_date || to.beginning_of_year
        runner = Runner.new(
          organization: organization, from: from, to: to,
          level: Accounting::Reports::RunParams.string(params, :level) || settings["level"] || "account",
          # Only levels the organization uses.
          center_level: (Accounting::Reports::RunParams.integer(params, :center_level) || settings["center_level"].presence&.to_i)
                          .then { |level| level&.between?(1, organization.center_levels) ? level : nil },
          approved_only: Accounting::Reports::RunParams.approved_only?(params)
        )
        hide_zero = Accounting::Reports::RunParams.boolean(params, :hide_zero, default: true)
        Payload.new(runner, runner.call, hide_zero: hide_zero).call
      end

      # Data of the trial balance print (Reports::TrialBalanceTemplate).
      def print(report, organization:, params:, access: nil)
        payload = run(report, organization: organization, params: params, access: access)
        amounts = Accounting::Reports::TrialBalanceTemplate::AMOUNTS
        rows = payload[:rows].map do |row|
          name = row[:prior_result] ? I18n.t("reports.trial_balance.prior_result") : row[:name]
          name = "#{name} — #{row[:center_code]} #{row[:center_name]}" if row[:center_id]
          { code: row[:code], name: name, **amounts.to_h { |key| [ key.to_sym, row[key.to_sym].to_f ] } }
        end
        Accounting::Reports::PrintHeader.call(organization: organization, from: payload[:from], to: payload[:to],
                                              approved_only: Accounting::Reports::RunParams.approved_only?(params))
                                        .merge(level_name: I18n.t("reports.trial_balance.levels.#{payload[:level]}"),
                                               **amounts.to_h { |key| [ :"total_#{key}", payload[:totals][key.to_sym].to_f ] },
                                               rows: rows)
      end

      def drill(*)
        raise ActiveRecord::RecordNotFound
      end
    end
  end
end
