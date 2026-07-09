class CreatePaymentEvents < ActiveRecord::Migration[8.0]
  def change
    create_table :payment_events do |t|
      t.references :payment, null: false, foreign_key: true, index: true
 
      t.string   :event_type
      t.jsonb    :payload, default: {}
      t.datetime :received_at, null: false
    end
    # Deliberately no updated_at - this is an append-only log, rows are
    # never modified after being written, only ever inserted.
  end
end
