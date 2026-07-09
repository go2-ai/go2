class CreateSubscriptions < ActiveRecord::Migration[8.0]
  def change
     create_table :subscriptions do |t|
      t.references :organization, null: false, foreign_key: true, index: true
 
      t.string :module, null: false   # G2::Modules value
      t.string :plan, null: false     # G2::Plans value
      t.references :price, null: false, foreign_key: true
 
      t.string :status, null: false, default: "active" # active, cancelled, expired
 
      t.datetime :starts_at, null: false
      t.datetime :ends_at, null: false
      t.datetime :cancelled_at
 
      t.string  :renewal_term            # G2::BillingPeriods value used on renewal
      t.boolean :auto_renew, null: false, default: true
 
      t.timestamps
    end
 
    # An org can only have ONE active subscription per module at a time.
    add_index :subscriptions, [:organization_id, :module],
              unique: true, where: "status = 'active'",
              name: "index_subscriptions_on_org_and_module_when_active"
 
    # For the background job that scans for lapsed/expiring subscriptions.
    add_index :subscriptions, :ends_at
  end
end
