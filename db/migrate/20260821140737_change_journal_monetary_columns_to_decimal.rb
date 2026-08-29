class ChangeJournalMonetaryColumnsToDecimal < ActiveRecord::Migration[8.0]
  def up
    # journal_entries
    change_column :journal_entries, :debit, :decimal, precision: 30, scale: 15, default: 0.0, null: false
    change_column :journal_entries, :credit, :decimal, precision: 30, scale: 15, default: 0.0, null: false

    # journal_entry_items
    change_column :journal_entry_items, :debit, :decimal, precision: 30, scale: 15, default: 0.0, null: false
    change_column :journal_entry_items, :credit, :decimal, precision: 30, scale: 15, default: 0.0, null: false
    change_column :journal_entry_items, :rate, :decimal, precision: 30, scale: 15, default: 1.0, null: false
    change_column :journal_entry_items, :currency_amount, :decimal, precision: 30, scale: 15, default: 0.0, null: false

    # NEW composite indexes only (individual indexes already exist)
    add_index :journal_entries, [ :organization_id, :fiscal_year_id, :no ]
    add_index :journal_entries, [ :organization_id, :date ]
    add_index :journal_entries, [ :organization_id, :daily_no, :date ]
    add_index :journal_entry_items, [ :journal_entry_id, :row ]
  end

  def down
    remove_index :journal_entries, [ :organization_id, :fiscal_year_id, :no ]
    remove_index :journal_entries, [ :organization_id, :date ]
    remove_index :journal_entries, [ :organization_id, :daily_no, :date ]
    remove_index :journal_entry_items, [ :journal_entry_id, :row ]

    change_column :journal_entries, :debit, :float
    change_column :journal_entries, :credit, :float

    change_column :journal_entry_items, :debit, :float
    change_column :journal_entry_items, :credit, :float
    change_column :journal_entry_items, :rate, :float
    change_column :journal_entry_items, :currency_amount, :float
  end
end
