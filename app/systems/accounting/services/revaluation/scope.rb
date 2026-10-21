# app/systems/accounting/services/revaluation/scope.rb
module Accounting
  module Revaluation
    # Which balances a revaluation covers. Each dimension is a list of ids;
    # a blank dimension means "all". Revaluation always covers monetary
    # accounts in foreign currencies only; the scope narrows that further.
    #
    #   account_ids, ledger_ids, currency_ids
    #   center_ids            the item has one of these centers at any level
    #   center1_ids..6_ids    the item has one of these centers at that level
    class Scope
      LEVELS = (1..6).freeze
      DIMENSIONS = [
        :account_ids, :ledger_ids, :currency_ids, :center_ids,
        *LEVELS.map { |level| :"center#{level}_ids" }
      ].freeze

      attr_reader :filters

      def initialize(raw = {})
        raw = raw.to_h.transform_keys(&:to_sym)
        @filters = DIMENSIONS.each_with_object({}) do |dimension, result|
          ids = Array(raw[dimension]).filter_map { |id| Integer(id, exception: false) }.uniq.sort
          result[dimension] = ids if ids.any?
        end.freeze
      end

      def to_h
        filters.transform_keys(&:to_s)
      end

      def ==(other)
        other.is_a?(Scope) && other.filters == filters
      end

      def everything?
        filters.empty?
      end

      # Filters for Accounting::Balances::Query.
      def query_filters
        filters.dup
      end

      # Whether a balance combination falls inside the scope. ledger_id is
      # the account's ledger.
      def match?(account_id:, ledger_id:, currency_id:, center_ids:)
        return false if filters[:account_ids] && !filters[:account_ids].include?(account_id)
        return false if filters[:ledger_ids] && !filters[:ledger_ids].include?(ledger_id)
        return false if filters[:currency_ids] && !filters[:currency_ids].include?(currency_id)
        return false if filters[:center_ids] && (filters[:center_ids] & center_ids.compact).empty?

        LEVELS.all? do |level|
          ids = filters[:"center#{level}_ids"]
          ids.nil? || ids.include?(center_ids[level - 1])
        end
      end
    end
  end
end
