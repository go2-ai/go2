# app/systems/accounting/services/revaluation/kind_toggler.rb
module Accounting
  module Revaluation
    # Changes the kind of a posted revaluation. The entry stays as it is.
    #
    # temporary → permanent: only when none of its posted combinations has
    #   draft or booked entries dated on or before its date, and none is
    #   already locked by another permanent revaluation dated on or after it.
    # permanent → temporary: only for the latest permanent revaluation of its
    #   combinations (later ones were built on top of it).
    class KindToggler
      def initialize(revaluation, kind:)
        @revaluation = revaluation
        @kind = kind.to_s
      end

      def call
        raise Builder::Error.new(:invalid_kind) unless Accounting::CurrencyRevaluation.kinds.key?(kind)
        raise Builder::Error.new(:not_posted) unless revaluation.posted?
        return revaluation if revaluation.kind == kind

        Accounting::CurrencyRevaluation.transaction do
          Builder.ensure_changeable!(FiscalYear.lock.find(revaluation.fiscal_year_id))
          kind == "permanent" ? check_can_become_permanent! : Succession.ensure_latest!(revaluation)
          revaluation.update!(kind: kind)
        end
        revaluation
      end

      private

      attr_reader :revaluation, :kind

      def check_can_become_permanent!
        items = Succession.posted_items(revaluation)
        return if items.empty?

        locks = PermanentLocks.new(revaluation.organization).preload_accounts(items.map(&:account_id))
        locked = items.find do |item|
          locks.blocking(account_id: item.account_id, currency_id: item.currency_id, center_ids: item.center_ids,
                         date: revaluation.as_of_date, exclude_id: revaluation.id)
        end
        raise Builder::Error.new(:locked_by_permanent) if locked

        keys = items.map(&:key).to_set
        unapproved = Builder.unapproved_keys(organization_id: revaluation.organization_id,
                                             fiscal_year_id: revaluation.fiscal_year_id,
                                             as_of_date: revaluation.as_of_date, account_ids: items.map(&:account_id).uniq)
        raise Builder::Error.new(:unapproved_entries) if unapproved.intersect?(keys)
      end
    end
  end
end
