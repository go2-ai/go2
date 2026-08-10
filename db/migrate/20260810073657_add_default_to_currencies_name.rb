class AddDefaultToCurrenciesName < ActiveRecord::Migration[8.0]
  def up
    change_column_default :currencies, :name, {}
    change_column_null :currencies, :name, false
  end

  def down
    change_column_null :currencies, :name, true
    change_column_default :currencies, :name, nil
  end
end
