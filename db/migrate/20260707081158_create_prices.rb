class CreatePrices < ActiveRecord::Migration[8.0]
  def change
    create_table :prices do |t|
      t.string  :module, null: false          # Go2::Modules value, e.g. "accounting"
      t.string  :plan, null: false            # Go2::Plans value, e.g. "level_2"
      t.string  :billing_period, null: false   # Go2::BillingPeriods value
 
      t.integer :amount_cents, null: false
      t.boolean :active, null: false, default: true
 
      t.datetime :created_at, null: false
      t.datetime :updated_at, null: false
    end
 
    # Only one ACTIVE price per module+plan+billing_period at a time - this
    # is what "the current price" means when creating a new subscription.
    add_index :prices, [:module, :plan, :billing_period],
              unique: true, where: "active = true",
              name: "index_prices_on_module_plan_period_when_active"
  end
end
