# app/systems/accounting/services/explorer/entry_scope.rb
module Accounting
  module Explorer
    # Raised when the explorer's period or entry type selection is invalid.
    # `key` is a translation key under controllers.journal_entry_items.
    class InvalidScopeError < StandardError
      attr_reader :key, :options

      def initialize(key, **options)
        @key = key
        @options = options
        super(key.to_s)
      end
    end

    # Which journal entries the explorer reads: a date range (defaulting to a
    # fiscal year), the entry types and the states.
    #
    # Within one fiscal year the selected entry types are used as given.
    # When the range spans two or more fiscal years, the year-end entries
    # (temporary closing, ending) and the beginning entries of the later years
    # would cancel out balances the range is meant to show, so they're left
    # out unless `include_year_end` is set. `beginning` then only selects the
    # first year's beginning entry.
    #
    # Every condition applies to journal_entries, so the scope works with any
    # relation that joins it.
    class EntryScope
      ENTRY_TYPES = Accounting::JournalEntry.entry_types.keys.freeze
      DEFAULT_ENTRY_TYPES = %w[normal beginning revaluation].freeze
      YEAR_END_TYPES = %w[closing_temp_accounts ending].freeze
      REGULAR_TYPES = %w[normal revaluation].freeze
      DEFAULT_STATES = %w[booked approved].freeze

      attr_reader :organization, :from, :to, :entry_types, :include_year_end, :approved_only

      # fiscal_year_id  used for the dates when from/to aren't given
      # entry_types     nil for the defaults; [] selects nothing
      def initialize(organization:, fiscal_year_id: nil, from: nil, to: nil, entry_types: nil,
                     include_year_end: false, approved_only: false)
        @organization = organization
        @entry_types = entry_types.nil? ? DEFAULT_ENTRY_TYPES : entry_types.map(&:to_s).uniq
        @include_year_end = include_year_end ? true : false
        @approved_only = approved_only ? true : false

        resolve_dates!(fiscal_year_id, from, to)
        validate!
      end

      # The fiscal years the range overlaps, earliest first.
      def fiscal_years
        @fiscal_years ||= organization.fiscal_years
                                      .where("start_date <= ? AND finish_date >= ?", to, from)
                                      .order(:start_date)
                                      .to_a
      end

      def multi_year?
        fiscal_years.size > 1
      end

      # True when the range starts after the first fiscal year's start, so its
      # balances leave out the entries posted before `from` (the beginning
      # entry included).
      def prior_entries_excluded?
        from > fiscal_years.first.start_date
      end

      def states
        approved_only ? %w[approved] : DEFAULT_STATES
      end

      # Limits a relation that joins journal_entries to this scope.
      def apply(relation)
        condition = entry_type_condition
        return relation.none if condition.nil?

        relation
          .where(
            journal_entries: {
              organization_id: organization.id,
              fiscal_year_id: fiscal_years.map(&:id),
              state: Accounting::JournalEntry.states.values_at(*states),
              date: from..to
            }
          )
          .where(condition)
      end

      def meta
        {
          from: from.iso8601,
          to: to.iso8601,
          fiscal_year_ids: fiscal_years.map(&:id),
          multi_year: multi_year?,
          prior_entries_excluded: prior_entries_excluded?
        }
      end

      private

      def resolve_dates!(fiscal_year_id, from, to)
        if from.nil? || to.nil?
          fiscal_year = organization.fiscal_years.find_by(id: fiscal_year_id)
          raise InvalidScopeError.new(:fiscal_year_required) if fiscal_year.nil?

          from ||= fiscal_year.start_date
          to ||= fiscal_year.finish_date
        end

        @from = from
        @to = to
      end

      def validate!
        unknown = entry_types - ENTRY_TYPES
        raise InvalidScopeError.new(:invalid_entry_types, types: unknown.join(", ")) if unknown.any?
        raise InvalidScopeError.new(:invalid_range) if from > to

        first_start, last_finish = organization.fiscal_years.pick(Arel.sql("MIN(start_date), MAX(finish_date)"))
        return if first_start && from >= first_start && to <= last_finish

        raise InvalidScopeError.new(:out_of_range, start_date: first_start&.iso8601, finish_date: last_finish&.iso8601)
      end

      # nil when nothing can match.
      def entry_type_condition
        table = Accounting::JournalEntry.arel_table
        values = Accounting::JournalEntry.entry_types
        types = ->(names) { table[:entry_type].in(values.values_at(*names)) }

        unless multi_year?
          selected = entry_types | (include_year_end ? YEAR_END_TYPES : [])
          return selected.empty? ? nil : types.call(selected)
        end

        first_year_id = fiscal_years.first.id
        beginning = table[:entry_type].eq(values["beginning"])
        conditions = []

        regular = entry_types & REGULAR_TYPES
        conditions << types.call(regular) if regular.any?
        conditions << beginning.and(table[:fiscal_year_id].eq(first_year_id)) if entry_types.include?("beginning")
        if include_year_end
          conditions << types.call(YEAR_END_TYPES)
          conditions << beginning.and(table[:fiscal_year_id].not_eq(first_year_id))
        end

        conditions.reduce { |all, condition| all.or(condition) }
      end
    end
  end
end
