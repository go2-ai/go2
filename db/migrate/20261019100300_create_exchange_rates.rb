class CreateExchangeRates < ActiveRecord::Migration[8.0]
  def change
    # One rate per currency, date and source: 1 unit of `currency` equals
    # `rate` units of `quote_currency` (the organization's main currency when
    # blank). Rates against another currency are converted to the main
    # currency through that currency's own rate (cross rate).
    create_table :exchange_rates do |t|
      t.references :organization, null: false, foreign_key: true
      t.references :currency, null: false, foreign_key: true
      t.references :quote_currency, foreign_key: { to_table: :currencies }
      t.date :date, null: false
      t.decimal :rate, precision: 30, scale: 15, null: false
      # "manual" or a provider key such as "ecb".
      t.string :source, null: false, default: "manual"
      # Provider details, e.g. the raw quoted pair.
      t.jsonb :meta, null: false, default: {}
      t.references :created_by, foreign_key: { to_table: :members }
      t.timestamps
    end
    add_index :exchange_rates, %i[organization_id currency_id date source],
              unique: true, name: "index_exchange_rates_uniqueness"
    add_index :exchange_rates, %i[currency_id date]

    # Where each currency's rates come from.
    create_table :exchange_rate_sources do |t|
      t.references :organization, null: false, foreign_key: true
      t.references :currency, null: false, foreign_key: true
      t.string :provider, null: false, default: "manual"
      # Currency the provider rate is quoted in; blank = main currency.
      t.references :quote_currency, foreign_key: { to_table: :currencies }
      t.boolean :active, null: false, default: true
      t.timestamps
    end
    add_index :exchange_rate_sources, %i[organization_id currency_id], unique: true
  end
end
