class AddMetadataToVersions < ActiveRecord::Migration[8.0]
  def change
    add_column :versions, :metadata, :jsonb, null: false, default: {}
    add_index :versions, :metadata, using: :gin
  end
end
