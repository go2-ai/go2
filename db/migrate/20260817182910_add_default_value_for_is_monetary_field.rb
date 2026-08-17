class AddDefaultValueForIsMonetaryField < ActiveRecord::Migration[8.0]
   def up
    change_column_null :ledgers, :is_monetary, false
    change_column_default :ledgers, :is_monetary, false
  end

  def down
    change_column_null :ledgers, :is_monetary, true
    change_column_default :ledgers, :is_monetary, nil
  end
end
