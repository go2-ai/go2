class ChangeGroupTranslatableFieldsDefault < ActiveRecord::Migration[8.0]
  def change
     change_column_default :groups, :name, from: nil, to: {}
     change_column_default :groups, :description, from: nil, to: {}
  end
end
