class CreateInvoices < ActiveRecord::Migration[8.0]
  def change
    create_table :invoices do |t|
      t.references :organization, null: false, foreign_key: true, index: true
 
      t.string  :invoice_number, null: false
      t.integer :total_cents, null: false, default: 0
      t.string  :status, null: false, default: "pending" # pending, paid, cancelled, void
 
      t.datetime :due_at
      t.datetime :paid_at
 
      t.timestamps
    end
 
    add_index :invoices, [:organization_id, :invoice_number], unique: true
    add_index :invoices, :status
  end
end
