# app/systems/accounting/services/revaluation/remover.rb
module Accounting
  module Revaluation
    # Deletes a revaluation together with its entry. A posted permanent
    # revaluation can only be deleted while no later permanent revaluation
    # covers the same balances (see Succession).
    class Remover
      SYSTEM_CONTEXT = :currency_revaluation

      # Deletes the revaluation's entry, if any. Raises Builder::Error when
      # the entry can't be deleted (e.g. its fiscal year is closed).
      def self.destroy_entry!(revaluation)
        entry = revaluation.journal_entry
        return if entry.nil?

        entry.system_context = SYSTEM_CONTEXT
        return if entry.destroy

        raise Builder::Error.new(:entry_not_removable, messages: entry.errors.full_messages)
      end

      def initialize(revaluation)
        @revaluation = revaluation
      end

      def call
        Accounting::CurrencyRevaluation.transaction do
          fiscal_year = FiscalYear.lock.find(revaluation.fiscal_year_id)
          Builder.ensure_changeable!(fiscal_year) if revaluation.posted?
          Succession.ensure_latest!(revaluation) if revaluation.posted? && revaluation.permanent?
          self.class.destroy_entry!(revaluation)
          revaluation.destroy!
        end
      end

      private

      attr_reader :revaluation
    end
  end
end
