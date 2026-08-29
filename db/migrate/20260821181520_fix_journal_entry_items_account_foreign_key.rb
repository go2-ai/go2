class FixJournalEntryItemsAccountForeignKey < ActiveRecord::Migration[8.0]
  def up
    remove_foreign_key :journal_entry_items, column: :account_id
    add_foreign_key :journal_entry_items, :accounts, column: :account_id
  end

  def down
    remove_foreign_key :journal_entry_items, column: :account_id
    add_foreign_key :journal_entry_items, :centers, column: :account_id
  end
end
