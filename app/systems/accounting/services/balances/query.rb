# app/systems/accounting/services/balances/query.rb
module Accounting
  module Balances
    # Balances of journal entry items grouped by account, center1..6 and
    # currency. This is the single source of truth for revaluation and
    # fiscal year closing calculations.
    #
    # Each row has, as BigDecimal:
    #   base_balance     = Σ debit − Σ credit (main currency)
    #   currency_balance = Σ +currency_amount on debit lines
    #                      − Σ currency_amount on credit lines (item currency).
    #                      For the main currency it equals base_balance.
    #   debit, credit    = Σ debit, Σ credit
    #
    # Positive balances are debit balances, negative ones credit balances.
    class Query
      CENTER_LEVELS = (1..6).freeze
      GROUP_COLUMNS = [
        "journal_entry_items.account_id",
        *CENTER_LEVELS.map { |level| "journal_entry_items.center#{level}_id" },
        "journal_entry_items.currency_id"
      ].freeze
      DEFAULT_STATES = %w[booked approved].freeze

      Row = Struct.new(:account_id, :center_ids, :currency_id, :debit, :credit,
                       :base_balance, :currency_balance, keyword_init: true) do
        # Identifies the account × centers × currency combination.
        def key
          [ account_id, *center_ids, currency_id ]
        end

        def center_id(level)
          center_ids[level - 1]
        end

        def zero?
          base_balance.zero? && currency_balance.zero?
        end
      end

      # organization:       required
      # fiscal_year:        FiscalYear or id; limits to entries of that year
      # as_of:              only entries dated on or before this date
      # from:               only entries dated on or after this date
      # states:             entry states to include (default booked + approved)
      # category_types:     AccountCategory types, e.g. %w[income_statement]
      # monetary_only:      only accounts of monetary ledgers
      # foreign_only:       exclude the main currency
      # account_ids, ledger_ids, account_category_ids, currency_ids,
      # center_ids (any level), center1_ids..center6_ids: limit to these (blank = all)
      # exclude_sources:    records whose generated entries are ignored
      # exclude_entry_ids:  entries to ignore
      # include_zero:       keep rows whose balances are both zero
      # entry_scope:        an Explorer::EntryScope; it then decides the
      #                     dates, entry types and states (`states` is ignored)
      def initialize(organization:, fiscal_year: nil, as_of: nil, from: nil, states: DEFAULT_STATES,
                     category_types: nil, monetary_only: false, foreign_only: false,
                     exclude_sources: [], exclude_entry_ids: [], include_zero: false, entry_scope: nil, **filters)
        @organization = organization
        @entry_scope = entry_scope
        @fiscal_year_id = fiscal_year.respond_to?(:id) ? fiscal_year.id : fiscal_year
        @as_of = as_of
        @from = from
        @states = Array(states).map(&:to_s)
        @category_types = Array(category_types).map(&:to_s).presence
        @monetary_only = monetary_only
        @foreign_only = foreign_only
        @exclude_sources = Array(exclude_sources)
        @exclude_entry_ids = Array(exclude_entry_ids)
        @include_zero = include_zero
        @filters = filters
        validate_filters!
      end

      def call
        rows = relation
               .group(*GROUP_COLUMNS.map { |column| Arel.sql(column) })
               .order(*GROUP_COLUMNS.map { |column| Arel.sql(column) })
               .pluck(*GROUP_COLUMNS.map { |column| Arel.sql(column) },
                      Arel.sql("COALESCE(SUM(journal_entry_items.debit), 0)"),
                      Arel.sql("COALESCE(SUM(journal_entry_items.credit), 0)"),
                      Arel.sql(signed_currency_amount_sql))
               .map { |values| build_row(values) }

        include_zero ? rows : rows.reject(&:zero?)
      end

      # Base relation of the items included, before grouping.
      def relation
        scope = Accounting::JournalEntryItem
                .joins(:journal_entry)
                .joins(account: { ledger: :account_category })
                .where(journal_entries: { organization_id: organization.id })

        scope = if entry_scope
          entry_scope.apply(scope)
        else
          scope.where(journal_entries: { state: Accounting::JournalEntry.states.values_at(*states) })
        end

        scope = scope.where(journal_entries: { fiscal_year_id: fiscal_year_id }) if fiscal_year_id
        scope = scope.where("journal_entries.date <= ?", as_of) if as_of
        scope = scope.where("journal_entries.date >= ?", from) if from
        if category_types
          scope = scope.where(account_categories: {
            type: Accounting::AccountCategory.types.values_at(*category_types)
          })
        end
        scope = scope.where(ledgers: { is_monetary: true }) if monetary_only
        scope = scope.where.not(journal_entry_items: { currency_id: main_currency_id }) if foreign_only && main_currency_id
        scope = scope.where.not(journal_entries: { id: exclude_entry_ids }) if exclude_entry_ids.any?
        exclude_sources.each do |source|
          # IS DISTINCT FROM keeps entries without a source (NULL columns).
          scope = scope.where(
            "journal_entries.source_type IS DISTINCT FROM ? OR journal_entries.source_id IS DISTINCT FROM ?",
            source.class.polymorphic_name, source.id
          )
        end
        apply_filters(scope)
      end

      private

      attr_reader :organization, :entry_scope, :fiscal_year_id, :as_of, :from, :states, :category_types,
                  :monetary_only, :foreign_only, :exclude_sources, :exclude_entry_ids,
                  :include_zero, :filters

      FILTER_COLUMNS = {
        account_ids: "journal_entry_items.account_id",
        ledger_ids: "accounts.ledger_id",
        account_category_ids: "ledgers.account_category_id",
        currency_ids: "journal_entry_items.currency_id",
        # The item has one of the centers at any level.
        center_ids: nil,
        **CENTER_LEVELS.to_h { |level| [ :"center#{level}_ids", "journal_entry_items.center#{level}_id" ] }
      }.freeze
      ANY_LEVEL_CENTER_SQL = CENTER_LEVELS.map { |level| "journal_entry_items.center#{level}_id IN (:ids)" }
                                          .join(" OR ").freeze

      def validate_filters!
        unknown = filters.keys - FILTER_COLUMNS.keys
        raise ArgumentError, "Unknown balance filters: #{unknown.join(', ')}" if unknown.any?

        unknown_states = states - Accounting::JournalEntry.states.keys
        raise ArgumentError, "Unknown states: #{unknown_states.join(', ')}" if unknown_states.any?
      end

      def apply_filters(scope)
        filters.each do |name, ids|
          ids = Array(ids).compact_blank
          next if ids.empty?

          if name == :center_ids
            scope = scope.where(ANY_LEVEL_CENTER_SQL, ids: ids)
            next
          end

          table, column = FILTER_COLUMNS.fetch(name).split(".")
          scope = scope.where(table => { column => ids })
        end
        scope
      end

      def main_currency_id
        @main_currency_id ||= organization.accounting_setting&.main_currency_id
      end

      # Main-currency items may have no currency_amount (rate blank); their
      # currency balance is the base amount itself.
      def signed_currency_amount_sql
        main = main_currency_id ? Integer(main_currency_id) : "NULL"
        <<~SQL.squish
          COALESCE(SUM(
            CASE
              WHEN journal_entry_items.currency_id = #{main}
                THEN journal_entry_items.debit - journal_entry_items.credit
              WHEN journal_entry_items.debit > 0
                THEN COALESCE(journal_entry_items.currency_amount, 0)
              ELSE -COALESCE(journal_entry_items.currency_amount, 0)
            END
          ), 0)
        SQL
      end

      # pluck already returns BigDecimals for decimal sums.
      def decimal(value)
        value.is_a?(BigDecimal) ? value : BigDecimal(value.to_s)
      end

      def build_row(values)
        account_id, *center_ids = values.first(7)
        currency_id, debit, credit, currency_balance = values.drop(7)
        debit = decimal(debit)
        credit = decimal(credit)

        Row.new(
          account_id: account_id,
          center_ids: center_ids,
          currency_id: currency_id,
          debit: debit,
          credit: credit,
          base_balance: debit - credit,
          currency_balance: decimal(currency_balance)
        )
      end
    end
  end
end
