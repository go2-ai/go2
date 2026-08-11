class ModifyCenters < ActiveRecord::Migration[8.0]
  def change
    change_column_null :centers, :name, false
    change_column_default :centers, :name, from: nil, to: {}
    add_column :centers, :metadata, :jsonb, null: false, default: {}
  end
end
