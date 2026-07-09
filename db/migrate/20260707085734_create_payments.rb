class CreatePayments < ActiveRecord::Migration[8.0]
  def change
    create_table :payments do |t|
      t.references :invoice, null: false, foreign_key: true, index: true
 
      t.string  :provider, null: false, default: "nowpayments"
      t.string  :provider_payment_id # the join key webhooks use to find this row
 
      t.integer :amount_cents, null: false
      t.string  :payment_status, null: false, default: "waiting"
 
      # Provider-specific fields (invoice_url, pay_address, pay_currency,
      # etc.) live here rather than as typed columns - a future Stripe/PayPal
      # payment would have a completely different shape, and this way adding
      # one needs zero migrations.
      t.jsonb :provider_response, default: {}
 
      t.datetime :paid_at
 
      t.timestamps
    end
 
    add_index :payments, :provider_payment_id, unique: true
    add_index :payments, :payment_status
  end
end
