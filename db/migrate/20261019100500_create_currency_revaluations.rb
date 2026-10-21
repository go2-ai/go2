class CreateCurrencyRevaluations < ActiveRecord::Migration[8.0]
  def change
    create_table :currency_revaluations do |t|
      t.references :organization, null: false, foreign_key: true
      t.references :fiscal_year, null: false, foreign_key: true
      t.date :as_of_date, null: false
      # temporary: 0, permanent: 1
      t.integer :kind, null: false, default: 0
      # draft: 0, posted: 1, superseded: 2
      t.integer :status, null: false, default: 0
      # Filters: account_ids, ledger_ids, currency_ids, center_ids (any
      # level), center1_ids..center6_ids. Blank = all monetary accounts in
      # foreign currencies.
      t.jsonb :scope, null: false, default: {}
      # Signature of the balances and rates the items were built from;
      # posting fails if they changed since.
      t.string :checksum
      t.jsonb :description, null: false, default: {}
      t.references :created_by, foreign_key: { to_table: :members }
      t.references :posted_by, foreign_key: { to_table: :members }
      t.datetime :posted_at
      t.datetime :superseded_at
      t.timestamps
    end
    add_index :currency_revaluations, %i[organization_id fiscal_year_id status kind],
              name: "index_currency_revaluations_lookup"

    create_table :currency_revaluation_items do |t|
      t.references :currency_revaluation, null: false, foreign_key: true
      t.references :account, null: false, foreign_key: true
      (1..6).each { |level| t.references :"center#{level}", foreign_key: { to_table: :centers } }
      t.references :currency, null: false, foreign_key: true
      # Signed balances (debit positive) as of the revaluation date.
      t.decimal :currency_balance, precision: 30, scale: 15, null: false
      t.decimal :book_base_balance, precision: 30, scale: 15, null: false
      t.decimal :rate, precision: 30, scale: 15
      t.date :rate_date
      t.decimal :revalued_base_balance, precision: 30, scale: 15
      t.decimal :difference, precision: 30, scale: 15, null: false, default: 0
      t.references :gain_loss_account, foreign_key: { to_table: :accounts }
      # Items not posted, e.g. without a rate; reason explains why.
      t.boolean :excluded, null: false, default: false
      t.string :excluded_reason
      t.timestamps
    end
  end
end
