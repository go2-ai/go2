module Accounting
  module Explorer
    class InvalidDimensionError < StandardError; end

    module Filtering
      DIMENSIONS = %w[
        account_category ledger account
        center1 center2 center3 center4 center5 center6
        currency
      ].freeze

      private

      def validate_dimension!(dimension)
        raise InvalidDimensionError, "Unknown dimension: #{dimension}" unless DIMENSIONS.include?(dimension)
      end

      # Booked + approved only — drafts aren't part of the trial-balance style report.
      # We always join account -> ledger since it's needed by several dimensions and
      # is safe: account is required on any non-draft item.
      def base_relation
        Accounting::JournalEntryItem
          .joins(:journal_entry)
          .joins(account: :ledger)
          .where(
            journal_entries: {
              organization_id: organization.id,
              fiscal_year_id: fiscal_year_id,
              state: Accounting::JournalEntry.states.values_at("booked", "approved")
            }
          )
      end

      def apply_filter(relation, dimension, ids)
        return relation if ids.blank?

        case dimension
        when "account_category"
          relation.where(ledgers: { account_category_id: ids })
        when "ledger"
          relation.where(accounts: { ledger_id: ids })
        when "account"
          relation.where(journal_entry_items: { account_id: ids })
        when "currency"
          relation.where(journal_entry_items: { currency_id: ids })
        when /\Acenter[1-6]\z/
          relation.where(journal_entry_items: { "#{dimension}_id" => ids })
        end
      end
    end
  end
end
