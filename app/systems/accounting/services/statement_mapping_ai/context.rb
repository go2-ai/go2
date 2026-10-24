module Accounting
  module StatementMappingAi
    # What the mapping assistant knows about an organization's statement:
    # its lines and rules, the chart of accounts and the balances of the
    # current period. Shared by the prompt and the lookup tools; loads
    # lazily and once per turn.
    class Context
      # The prompt lists the ledgers when there are at most this many;
      # otherwise the assistant looks them up with tools.
      INLINE_LEDGERS = 80

      attr_reader :report, :layout, :organization

      def initialize(report)
        @report = report
        @layout = report.statement_layout
        @organization = report.organization
      end

      def column
        @column ||= Accounting::Statements::ReportType.columns(report, organization, { comparison: false }).first
      end

      def lines
        layout.lines.map do |line|
          { key: line.key, parent: parent_keys[line.parent_id], kind: line.kind, side: line.normal_side,
            label: line.label, formula: line.formula }.compact
        end
      end

      def rules
        keys = layout.lines.to_h { |line| [ line.id, line.key ] }
        layout.rules.each_with_index.map do |rule, index|
          { number: index + 1, line: keys[rule.statement_line_id], opposite_line: keys[rule.opposite_line_id],
            selector_type: rule.selector_type, selector: describe_selector(rule), center_level: rule.center_level,
            grain: rule.grain, measure: rule.measure, priority: rule.priority }.compact
        end
      end

      def ledgers
        @ledger_list ||= Accounting::Ledger.joins(:account_category)
                                           .where(account_categories: { organization_id: organization.id })
                                           .includes(:account_category, :accounts, parent_ledger: :account_category).order("account_categories.code", :code)
                                           .map do |ledger|
          {
            code: ledger.full_code, names: ledger.read_attribute(:name), category: ledger.account_category.identifier,
            monetary: ledger.is_monetary, contra_for: ledger.parent_ledger&.full_code,
            accounts: ledger.accounts.size, balance: amount(ledger_balances[ledger.id])
          }.compact
        end
      end

      def accounts_in(ledger_code)
        ledger = ledger_index[ledger_code.to_s]
        return nil unless ledger

        ledger.accounts.sort_by(&:code).map do |account|
          {
            code: account.full_code, names: account.read_attribute(:name), contra_for: account.parent_account&.full_code,
            balance: amount(account_balances[account.id])
          }.compact
        end
      end

      # How an account's balance splits over the centers of a level: how
      # many centers are in debit or credit and their totals.
      def balance_signs(account_code, center_level)
        account = account_index[account_code.to_s]
        return nil unless account

        level = center_level.to_i.clamp(1, 6)
        by_center = Hash.new(BigDecimal("0"))
        rows.select { |row| row.account_id == account.id }.each { |row| by_center[row.center_id(level)] += row.value }
        debit = by_center.values.select(&:positive?)
        credit = by_center.values.select(&:negative?)
        {
          account: account.full_code, center_level: level, balance: amount(by_center.values.sum(BigDecimal("0"))),
          centers_in_debit: debit.size, debit_total: amount(debit.sum(BigDecimal("0"))),
          centers_in_credit: credit.size, credit_total: amount(credit.sum(BigDecimal("0"))),
          without_center: by_center.key?(nil)
        }
      end

      # Balances no rule maps, by account.
      def unmapped
        engine = Accounting::Statements::Engine.from_layout(layout, rows: rows.select { |r| category_types.include?(r.category_type) },
                                                            setting_accounts: setting_accounts).call
        engine.unmapped.group_by { |resolution| resolution.row.account_id }.map do |account_id, list|
          account = accounts_by_id[account_id]
          { account: account&.full_code, name: account&.name, ledger: account && ledger_code_of(account),
            balance: amount(list.sum(BigDecimal("0"), &:amount)) }
        end
      end

      # Counted without the balances (the prompt only lists ledgers of small charts).
      def ledger_count
        ledger_index.size
      end

      def center_levels
        organization.center_levels
      end

      def center_types
        organization.center_types.map { |type| type.name.to_s }
      end

      def currencies
        organization.currencies.pluck(:abr)
      end

      private

      def rows
        @rows ||= Accounting::Statements::Runner.new(report: report, organization: organization, columns: [ column ])
                                                .rows_for(column)
      end

      def category_types
        layout.category_types
      end

      def setting_accounts
        Accounting::Statements::Periods.setting_accounts(organization)
      end

      def account_balances
        @account_balances ||= rows.each_with_object(Hash.new(BigDecimal("0"))) { |row, sums| sums[row.account_id] += row.value }
      end

      def ledger_balances
        @ledger_balances ||= rows.each_with_object(Hash.new(BigDecimal("0"))) { |row, sums| sums[row.ledger_id] += row.value }
      end

      def ledger_index
        @ledger_index ||= Accounting::Ledger.joins(:account_category).where(account_categories: { organization_id: organization.id })
                                            .includes(:account_category, accounts: { parent_account: { ledger: :account_category } })
                                            .index_by(&:full_code)
      end

      def ledgers_by_id
        @ledgers_by_id ||= ledger_index.values.index_by(&:id)
      end

      def account_index
        @account_index ||= accounts_by_id.values.index_by(&:full_code)
      end

      def accounts_by_id
        @accounts_by_id ||= Accounting::Account.joins(ledger: :account_category)
                                               .where(account_categories: { organization_id: organization.id })
                                               .includes(ledger: :account_category).index_by(&:id)
      end

      def ledger_code_of(account)
        account.ledger.full_code
      end

      def parent_keys
        @parent_keys ||= layout.lines.to_h { |line| [ line.id, line.key ] }
      end

      def describe_selector(rule)
        data = rule.selector.to_h
        case rule.selector_type
        when "ledger"
          { ledger_codes: ledgers_by_id.values_at(*Array(data["ids"]).map(&:to_i)).compact.map(&:full_code) }
        when "account"
          { account_codes: accounts_by_id.values_at(*Array(data["ids"]).map(&:to_i)).compact.map(&:full_code),
            settings: data["settings"] }.compact_blank
        when "category"
          ids = Array(data["ids"])
          extra = ids.any? ? organization.account_categories.where(id: ids).pluck(:identifier).compact : []
          { identifiers: Array(data["identifiers"]) | extra }
        else data
        end
      end

      def amount(value)
        (@money ||= Accounting::MoneyFormat.new(organization)).amount(value)
      end
    end
  end
end
