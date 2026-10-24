module Accounting
  module Statements
    # The layout editor's data: lines, rules, and the chart of accounts,
    # center types, centers and currencies its pickers offer.
    class LayoutPayload
      def initialize(layout, organization:)
        @layout = layout
        @organization = organization
      end

      def call
        lines = layout.lines.to_a
        keys = lines.to_h { |line| [ line.id, line.key ] }
        {
          report_id: layout.report_id,
          statement_type: layout.statement_type,
          settings: layout.settings,
          center_levels: organization.center_levels,
          lines: lines.map { |line| line_json(line) },
          rules: layout.rules.each_with_index.map { |rule, index| rule_json(rule, index + 1, keys) },
          chart: chart_json
        }
      end

      def line_json(line)
        {
          id: line.id, key: line.key, parent_id: line.parent_id, position: line.position, kind: line.kind,
          normal_side: line.normal_side, label: line.label, labels: line.read_attribute(:label) || {},
          formula: line.formula, style: line.style, metadata: line.metadata
        }
      end

      def rule_json(rule, number, keys)
        {
          id: rule.id, number: number, statement_line_id: rule.statement_line_id, line_key: keys[rule.statement_line_id],
          opposite_line_id: rule.opposite_line_id, opposite_line_key: keys[rule.opposite_line_id],
          selector_type: rule.selector_type, selector: rule.selector, center_level: rule.center_level,
          center_ids: rule.center_ids, center_type_ids: rule.center_type_ids, currency_ids: rule.currency_ids,
          grain: rule.grain, measure: rule.measure, priority: rule.priority, position: rule.position,
          specificity: rule.specificity, note: rule.note
        }
      end

      private

      attr_reader :layout, :organization

      # The chart of accounts, centers and currencies for pickers.
      def chart_json
        categories = organization.account_categories.order(:code).to_a
        ledgers = Accounting::Ledger.where(account_category: categories).includes(:account_category).order(:code).to_a
        accounts = Accounting::Account.where(ledger: ledgers).includes(ledger: :account_category).order(:code).to_a
        center_types = organization.center_types.order(:first_code).to_a
        {
          categories: categories.map do |category|
            { id: category.id, identifier: category.identifier, code: category.code, name: category.name, type: category.type }
          end,
          ledgers: ledgers.map do |ledger|
            { id: ledger.id, category_id: ledger.account_category_id, code: ledger.full_code, name: ledger.name }
          end,
          accounts: accounts.map do |account|
            { id: account.id, ledger_id: account.ledger_id, code: account.full_code,
              name: account.name }
          end,
          center_types: center_types.map { |type| { id: type.id, name: type.name } },
          centers: Accounting::Center.where(center_type: center_types).order(:code).map do |center|
            { id: center.id, center_type_id: center.center_type_id, code: center.code, name: center.name }
          end,
          currencies: organization.currencies.order(:abr).map { |currency| { id: currency.id, abr: currency.abr } },
          setting_accounts: Accounting::StatementMappingRule::SETTING_ACCOUNTS
        }
      end
    end
  end
end
