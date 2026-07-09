class CreateUsageRecords < ActiveRecord::Migration[8.0]
  def change
    create_table :usage_records do |t|
      t.references :organization, null: false, foreign_key: true, index: true
 
      t.string :module, null: false   # G2::Modules value
      t.string :key, null: false      # e.g. "journal_entries", "storage_gb"
      t.date   :period, null: false   # the DAY this usage occurred/was measured
 
      t.integer :quantity, null: false, default: 0
 
      t.timestamps
    end
 
    # One row per org+module+key+day - lets us atomically increment via
    # INSERT ... ON CONFLICT DO UPDATE instead of read-then-write, which
    # would race under concurrent usage.
    add_index :usage_records, [:organization_id, :module, :key, :period],
              unique: true, name: "index_usage_records_on_org_module_key_period"
  end
end
