class AddStorageFieldsToOrganizations < ActiveRecord::Migration[8.0]
  def change
    add_column :organizations, :max_file_size, :integer, null: false, default: 50
    add_column :organizations, :total_file_size, :bigint, null: false, default: 0
    add_column :organizations, :max_total_file_size, :integer, null: false, default: 10
  end
end
