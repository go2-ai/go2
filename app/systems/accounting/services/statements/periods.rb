module Accounting
  module Statements
    # Fiscal-year and entry-type rules shared by the statement, trial
    # balance and ratio runs.
    module Periods
      # Movements of a period: the opening entry is the previous year's
      # closing balance, not a movement.
      REGULAR_TYPES = %w[normal revaluation].freeze
      # Cash flows: revaluations are shown on their own line.
      CASH_FLOW_TYPES = %w[normal].freeze
      # Balances: everything from the opening entry on.
      DEFAULT_TYPES = %w[normal beginning revaluation].freeze

      module_function

      # The fiscal year containing `date`, else the last one starting before it.
      def fiscal_year_for(organization, date)
        return nil unless organization

        organization.fiscal_years.containing(date).first ||
          organization.fiscal_years.where("start_date <= ?", date).order(start_date: :desc).first
      end

      # [first start, last finish] of the organization's fiscal years.
      def bounds(organization)
        return [ nil, nil ] unless organization

        organization.fiscal_years.pick(Arel.sql("MIN(start_date), MAX(finish_date)")) || [ nil, nil ]
      end

      def first_start(organization)
        bounds(organization).first
      end

      def within_fiscal_years?(organization, from, to)
        first, last = bounds(organization)
        first.present? && from >= first && to <= last
      end

      def entry_scope(organization, from, to, types, approved_only: false)
        Accounting::Explorer::EntryScope.new(organization: organization, from: from, to: to, entry_types: types,
                                             approved_only: approved_only)
      end

      # The accounts named in the accounting settings, for mapping rules.
      def setting_accounts(organization)
        setting = organization.accounting_setting
        Accounting::StatementMappingRule::SETTING_ACCOUNTS.to_h { |name| [ name, setting&.public_send(name) ] }
      end
    end
  end
end
