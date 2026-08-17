class FixAccountsCodeUniquenessScope < ActiveRecord::Migration[8.0]
  def up
    # Remove the global unique index on code
    remove_index :accounts, name: "index_accounts_on_code"

    # Add composite unique index scoped to ledger_id
    add_index :accounts, [ :ledger_id, :code ], unique: true
  end

  def down
    # Restore original state
    remove_index :accounts, column: [ :ledger_id, :code ]

    add_index :accounts, :code, unique: true
  end
end
