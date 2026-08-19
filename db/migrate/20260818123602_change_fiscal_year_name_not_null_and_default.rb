class ChangeFiscalYearNameNotNullAndDefault < ActiveRecord::Migration[8.0]
  def up
    change_column_null :fiscal_years, :name, false
    change_column_default :fiscal_years, :name, {}
  end

  def down
    change_column_null :fiscal_years, :name, true
    change_column_default :fiscal_years, :name, nil
  end
end
