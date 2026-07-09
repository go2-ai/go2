class CreatePlanLimits < ActiveRecord::Migration[8.0]
  def change
    create_table :plan_limits do |t|
      t.string  :module, null: false   # Go2::Modules value
      t.string  :plan, null: false     # Go2::Plans value
      t.string  :key, null: false      # e.g. "storage_gb", "journal_entries"
 
      t.integer :value                  # included allowance; nil = unlimited
      t.integer :overage_price_cents    # per-unit overage cost; nil = no overage possible
 
      t.timestamps
    end
 
    add_index :plan_limits, [:module, :plan, :key], unique: true
  end
end
