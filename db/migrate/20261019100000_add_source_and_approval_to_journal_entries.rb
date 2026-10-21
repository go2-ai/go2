class AddSourceAndApprovalToJournalEntries < ActiveRecord::Migration[8.0]
  # entry_type values before and after this migration:
  #   before: normal 0, beginning 1, ending 2
  #   after:  normal 0, beginning 1, revaluation 2, closing_temp_accounts 3, ending 4
  def up
    change_table :journal_entries, bulk: true do |t|
      # The record that generated the entry (CurrencyRevaluation, FiscalYear).
      # Blank for entries created by users.
      t.references :source, polymorphic: true, index: true
      t.datetime :approved_at
      t.references :approved_by, foreign_key: { to_table: :members }, index: true
    end

    execute "UPDATE journal_entries SET entry_type = 4 WHERE entry_type = 2"
  end

  def down
    execute "UPDATE journal_entries SET entry_type = 0 WHERE entry_type IN (2, 3)"
    execute "UPDATE journal_entries SET entry_type = 2 WHERE entry_type = 4"

    change_table :journal_entries, bulk: true do |t|
      t.remove_references :approved_by, foreign_key: { to_table: :members }, index: true
      t.remove :approved_at
      t.remove_references :source, polymorphic: true, index: true
    end
  end
end
