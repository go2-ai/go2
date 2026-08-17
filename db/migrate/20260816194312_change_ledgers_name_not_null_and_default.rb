class ChangeLedgersNameNotNullAndDefault < ActiveRecord::Migration[8.0]
  def up
    change_column_null :ledgers, :name, false
    change_column_default :ledgers, :name, {}
    remove_column :ledgers, :balance_type
  end

  def down
    change_column_null :ledgers, :name, true
    change_column_default :ledgers, :name, nil
    add_column :ledgers, :balance_type, :integer, null: false
  end
end
