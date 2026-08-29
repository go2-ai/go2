class ChangeJournalEntryItemsDescriptionDefault < ActiveRecord::Migration[8.0]
  def up
    change_column :journal_entry_items, :description, :jsonb, default: {}, null: false
  end

  def down
    change_column :journal_entry_items, :description, :jsonb
  end
end
