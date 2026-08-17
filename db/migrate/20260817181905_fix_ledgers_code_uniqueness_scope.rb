class FixLedgersCodeUniquenessScope < ActiveRecord::Migration[8.0]
  def up
    remove_index :ledgers, name: "index_ledgers_on_code"
    add_index :ledgers, [ :account_category_id, :code ], unique: true
  end

  def down
    remove_index :ledgers, column: [ :account_category_id, :code ]
    add_index :ledgers, :code, unique: true
  end
end
