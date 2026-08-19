class ChangeAccountsNameNotNullAndDefault < ActiveRecord::Migration[8.0]
  def up
    change_column_null :accounts, :name, false
    change_column_default :accounts, :name, {}
  end

  def down
    change_column_null :accounts, :name, true
    change_column_default :accounts, :name, nil
  end
end
