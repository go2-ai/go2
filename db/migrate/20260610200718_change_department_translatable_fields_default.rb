class ChangeDepartmentTranslatableFieldsDefault < ActiveRecord::Migration[8.0]
  def change
     change_column_default :departments, :name, from: nil, to: {}
     change_column_default :departments, :description, from: nil, to: {}
  end
end
