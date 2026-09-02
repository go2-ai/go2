# app/systems/accounting/services/explorer/items_query.rb
module Accounting
  module Explorer
    # Returns the flat, ungrouped journal_entry_items matching the same
    # filters GroupedSummaryQuery would apply — this is the "drill-down"
    # from an aggregate row back to the records that produced it.
    class ItemsQuery
      include Filtering

      def initialize(organization:, fiscal_year_id:, filters: [])
        @organization = organization
        @fiscal_year_id = fiscal_year_id
        @filters = filters || []

        @filters.each { |f| validate_dimension!(f[:dimension].to_s) }
      end

      def call
        relation = base_relation
        filters.each { |f| relation = apply_filter(relation, f[:dimension].to_s, f[:ids]) }

        relation
          .includes(
            :currency,
            :center1, :center2, :center3, :center4, :center5, :center6,
            account: { ledger: :account_category },
            journal_entry: :fiscal_year
          )
          .order("journal_entries.date DESC, journal_entries.no DESC, journal_entry_items.row ASC")
      end

      private

      attr_reader :organization, :fiscal_year_id, :filters
    end
  end
end
