# app/systems/accounting/services/balances/row_presenter.rb
module Accounting
  module Balances
    # JSON for Balances::Query rows, with account, center and currency labels.
    # Loads the referenced records with one query per table.
    class RowPresenter
      def initialize(rows)
        @rows = rows
      end

      def as_json(*)
        rows.map do |row|
          account = accounts[row.account_id]
          {
            account_id: row.account_id,
            account_code: account&.full_code,
            account_name: account&.name,
            centers: row.center_ids.each_with_index.filter_map do |center_id, index|
              next unless center_id

              center = centers[center_id]
              { level: index + 1, id: center_id, code: center&.code, name: center&.name }
            end,
            currency_id: row.currency_id,
            currency_abr: currencies[row.currency_id]&.abr,
            debit: decimal(row.debit),
            credit: decimal(row.credit),
            base_balance: decimal(row.base_balance),
            currency_balance: decimal(row.currency_balance)
          }
        end
      end

      private

      attr_reader :rows

      def decimal(value)
        value.to_s("F")
      end

      def accounts
        @accounts ||= Accounting::Account.includes(ledger: :account_category)
                                         .where(id: rows.map(&:account_id).uniq).index_by(&:id)
      end

      def centers
        @centers ||= Accounting::Center.where(id: rows.flat_map(&:center_ids).compact.uniq).index_by(&:id)
      end

      def currencies
        @currencies ||= Accounting::Currency.where(id: rows.map(&:currency_id).uniq).index_by(&:id)
      end
    end
  end
end
