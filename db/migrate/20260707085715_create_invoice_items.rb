class CreateInvoiceItems < ActiveRecord::Migration[8.0]
  def change
    create_table :invoice_items do |t|
      t.references :invoice, null: false, foreign_key: true, index: true
      # Nullable - most items will reference the subscription they're
      # billing for, but this leaves room for one-off, non-subscription
      # line items later without a schema change.
      t.references :subscription, null: true, foreign_key: true, index: true
 
      t.string :module, null: false
      t.string :plan, null: false
 
      t.integer :quantity, null: false, default: 1
      t.integer :unit_price_cents, null: false
      t.integer :amount_cents, null: false # quantity * unit_price_cents, snapshotted
 
      t.datetime :period_start
      t.datetime :period_end
 
      t.timestamps
    end
  end
end
