# app/systems/accounting/services/revaluation/permanent_locks.rb
module Accounting
  module Revaluation
    # Posted permanent revaluations lock their scope: balances of monetary
    # accounts in foreign currencies that match the scope, dated on or before
    # the revaluation date, must not change anymore (otherwise the revalued
    # book value would be wrong). Combinations the user left out of the
    # revaluation are not locked by it. Loads the organization's posted permanent
    # revaluations once; reuse an instance for many checks.
    class PermanentLocks
      def initialize(organization)
        @organization = organization
      end

      def revaluations
        @revaluations ||= Accounting::CurrencyRevaluation
                          .where(organization_id: organization.id, status: :posted, kind: :permanent)
                          .order(as_of_date: :desc, id: :desc)
                          .to_a
      end

      def any_on_or_after?(date)
        date.present? && revaluations.any? { |revaluation| revaluation.as_of_date >= date }
      end

      # The latest posted permanent revaluation locking a balance of
      # account × centers × currency dated `date`, or nil.
      def blocking(account_id:, currency_id:, center_ids:, date:, exclude_id: nil)
        return nil if account_id.nil? || date.nil? || !any_on_or_after?(date)

        info = account_info(account_id)
        return nil unless info && info[:monetary] && currency_id != main_currency_id

        revaluations.find do |revaluation|
          next false if revaluation.id == exclude_id || revaluation.as_of_date < date
          next false if revaluation.removed_key_set.include?([ account_id, *center_ids, currency_id ])

          revaluation.scope_filter.match?(account_id: account_id, ledger_id: info[:ledger_id],
                                          currency_id: currency_id, center_ids: center_ids)
        end
      end

      # Loads ledger info of these accounts in one query.
      def preload_accounts(account_ids)
        missing = Array(account_ids).compact.uniq - accounts.keys
        return self if missing.empty?

        Accounting::Account.joins(:ledger).where(id: missing)
                           .pluck(:id, :ledger_id, "ledgers.is_monetary")
                           .each { |id, ledger_id, monetary| accounts[id] = { ledger_id: ledger_id, monetary: monetary } }
        missing.each { |id| accounts[id] ||= nil }
        self
      end

      private

      attr_reader :organization

      def accounts
        @accounts ||= {}
      end

      def account_info(account_id)
        preload_accounts([ account_id ]) unless accounts.key?(account_id)
        accounts[account_id]
      end

      def main_currency_id
        @main_currency_id ||= organization.accounting_setting&.main_currency_id
      end
    end
  end
end
