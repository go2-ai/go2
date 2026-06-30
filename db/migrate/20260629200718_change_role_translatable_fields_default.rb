class ChangeRoleTranslatableFieldsDefault < ActiveRecord::Migration[8.0]
  def change
     change_column_default :roles, :name, from: nil, to: {}
     change_column_default :roles, :description, from: nil, to: {}
  end
end
