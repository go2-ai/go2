class MakeJournalEntryItemRateAndAmountNullable < ActiveRecord::Migration[8.0]
  def up
    change_column :journal_entry_items, :rate, :decimal, precision: 30, scale: 15, null: true
    change_column :journal_entry_items, :currency_amount, :decimal, precision: 30, scale: 15, null: true
  end

  def down
    # Clean up any nulls before restoring NOT NULL
    execute <<-SQL
      UPDATE journal_entry_items SET rate = 1.0 WHERE rate IS NULL
    SQL
    execute <<-SQL
      UPDATE journal_entry_items SET currency_amount = 0.0 WHERE currency_amount IS NULL
    SQL

    change_column :journal_entry_items, :rate, :decimal, precision: 30, scale: 15, default: "1.0", null: false
    change_column :journal_entry_items, :currency_amount, :decimal, precision: 30, scale: 15, default: "0.0", null: false
  end
end
