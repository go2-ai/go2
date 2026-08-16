class ChangeAccountCategoriesNameNotNullAndDefault < ActiveRecord::Migration[8.0]
  def up
    change_column_null :account_categories, :name, false
    change_column_default :account_categories, :name, {}
  end

  def down
    change_column_null :account_categories, :name, true
    change_column_default :account_categories, :name, nil
  end
end