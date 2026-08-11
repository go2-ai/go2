class ModifyCenterTypes < ActiveRecord::Migration[8.0]
  def change
    change_column_null :center_types, :name, false
    change_column_default :center_types, :name, from: nil, to: {}
    add_index :center_types, :name, using: :gin
    remove_column :center_types, :scope, :string
    add_column :center_types, :metadata, :jsonb, null: false, default: []
  end
end
