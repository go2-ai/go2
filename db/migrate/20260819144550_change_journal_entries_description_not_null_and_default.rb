class ChangeJournalEntriesDescriptionNotNullAndDefault < ActiveRecord::Migration[8.0]
  def up
    change_column_null :journal_entries, :description, false
    change_column_default :journal_entries, :description, {}
  end

  def down
    change_column_null :journal_entries, :description, true
    change_column_default :journal_entries, :description, nil
  end
end
