module Accounting
  module Explorer
    class GroupedSummaryQuery
      include Filtering

      def initialize(organization:, fiscal_year_id:, group_by:, filters: [])
        @organization = organization
        @fiscal_year_id = fiscal_year_id
        @group_by = group_by.to_s
        @filters = filters || []

        validate_dimension!(@group_by)
        @filters.each { |f| validate_dimension!(f[:dimension].to_s) }
      end

      def call
        relation = base_relation
        filters.each { |f| relation = apply_filter(relation, f[:dimension].to_s, f[:ids]) }

        column = column_for(group_by)

        rows_data = relation
          .group(Arel.sql(column))
          .pluck(
            Arel.sql(column),
            Arel.sql("SUM(journal_entry_items.debit)"),
            Arel.sql("SUM(journal_entry_items.credit)")
          )

        ids = rows_data.map(&:first).compact
        records_by_id = lookup_records(group_by, ids)

        rows = rows_data.filter_map do |id, sum_debit, sum_credit|
          record = records_by_id[id]
          next unless record

          sum_debit = sum_debit.to_f
          sum_credit = sum_credit.to_f
          net = (sum_debit - sum_credit).round(2)

          {
            id: id,
            code: code_for(record, group_by),
            name: record.name,
            sum_debit: sum_debit,
            sum_credit: sum_credit,
            debit_balance: net.positive? ? net : nil,
            credit_balance: net.negative? ? -net : nil
          }
        end

        rows.sort_by { |r| r[:code].to_s }
      end

      private

      attr_reader :organization, :fiscal_year_id, :group_by, :filters

      def column_for(dimension)
        case dimension
        when "account_category" then "ledgers.account_category_id"
        when "ledger" then "accounts.ledger_id"
        when "account" then "journal_entry_items.account_id"
        when "currency" then "journal_entry_items.currency_id"
        when /\Acenter[1-6]\z/ then "journal_entry_items.#{dimension}_id"
        end
      end

      def lookup_records(dimension, ids)
        return {} if ids.empty?

        relation = case dimension
        when "account_category" then Accounting::AccountCategory.where(id: ids)
        when "ledger" then Accounting::Ledger.where(id: ids).includes(:account_category)
        when "account" then Accounting::Account.where(id: ids).includes(ledger: :account_category)
        when "currency" then Accounting::Currency.where(id: ids)
        when /\Acenter[1-6]\z/ then Accounting::Center.where(id: ids)
        end

        relation.index_by(&:id)
      end

      # Currency has no `code` column — it uses `abr`.
      def code_for(record, dimension)
        case dimension
        when "currency" then record.abr
        when "ledger", "account" then record.full_code
        else record.code
        end
      end
    end
  end
end
