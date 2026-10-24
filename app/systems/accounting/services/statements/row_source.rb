module Accounting
  module Statements
    # Loads Engine::Rows from the ledger: Balances::Query rows (account ×
    # center1..6 × currency) for an EntryScope, with the account's ledger,
    # category and full code and the centers' types attached.
    class RowSource
      def initialize(organization:, filters: {})
        @organization = organization
        @filters = filters.to_h.symbolize_keys
      end

      # period: "prior" | "current" (only meaningful for income statement rows)
      # values (debit positive): balance and change (Σ debit − Σ credit of the
      # scope), debit_movement (Σ debit) and credit_movement (−Σ credit).
      def rows(entry_scope, period: "current")
        balance_rows = Accounting::Balances::Query.new(organization: organization, entry_scope: entry_scope,
                                                       **filters).call
        load_references(balance_rows)
        balance_rows.filter_map do |balance|
          account = accounts[balance.account_id]
          next unless account

          Engine::Row.new(
            key: balance.key, account_id: balance.account_id, ledger_id: account[:ledger_id],
            category_id: account[:category_id], category_identifier: account[:identifier],
            category_type: account[:category_type], account_code: account[:code],
            center_ids: balance.center_ids, center_type_ids: balance.center_ids.map { |id| center_types[id] },
            currency_id: balance.currency_id, period: period,
            values: {
              "balance" => balance.base_balance, "change" => balance.base_balance,
              "debit_movement" => balance.debit, "credit_movement" => -balance.credit
            }
          )
        end
      end

      def accounts
        @accounts ||= Accounting::AccountReferences.new
      end

      private

      attr_reader :organization, :filters

      def load_references(balance_rows)
        accounts.load(balance_rows.map(&:account_id))
        center_ids = balance_rows.flat_map(&:center_ids).compact.uniq - center_types.keys
        Accounting::Center.where(id: center_ids).pluck(:id, :center_type_id).each { |id, type| center_types[id] = type }
      end

      def center_types
        @center_types ||= {}
      end
    end
  end
end
