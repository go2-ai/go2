# app/systems/accounting/services/revaluation/succession.rb
module Accounting
  module Revaluation
    # Order of permanent revaluations over the same balances. A permanent
    # revaluation posts only the difference on top of earlier ones, so it
    # can't be removed (or made temporary) while a later permanent
    # revaluation covers any of the same combinations.
    module Succession
      module_function

      # Items that were posted (not excluded or left out, with a difference).
      def posted_items(revaluation)
        revaluation.items.select(&:postable?)
      end

      # Posted permanent revaluations after this one (later date, or same date
      # and created later) sharing at least one posted combination.
      def later_permanents(revaluation)
        keys = posted_items(revaluation).map(&:key).to_set
        return [] if keys.empty?

        Accounting::CurrencyRevaluation
          .where(organization_id: revaluation.organization_id, status: :posted, kind: :permanent)
          .where.not(id: revaluation.id)
          .where("as_of_date > :date OR (as_of_date = :date AND id > :id)", date: revaluation.as_of_date, id: revaluation.id)
          .includes(:items)
          .order(:as_of_date, :id)
          .select { |later| posted_items(later).any? { |item| keys.include?(item.key) } }
      end

      def ensure_latest!(revaluation)
        later = later_permanents(revaluation).first
        return if later.nil?

        raise Builder::Error.new(:later_permanent_exists, date: later.as_of_date)
      end
    end
  end
end
