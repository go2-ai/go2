class DropBranchesTable < ActiveRecord::Migration[8.0]
  def up
    remove_foreign_key :journal_entries, :branches if foreign_key_exists?(:journal_entries, :branches)
    remove_column :journal_entries, :branch_id, :bigint if column_exists?(:journal_entries, :branch_id)
    drop_table :branches if table_exists?(:branches)
  end

  def down
    create_table "branches", force: :cascade do |t|
      t.jsonb "name"
      t.string "code"
      t.bigint "organization_id", null: false
      t.datetime "created_at", null: false
      t.datetime "updated_at", null: false
      t.index [ "code" ], name: "index_branches_on_code"
      t.index [ "name" ], name: "index_branches_on_name", using: :gin
      t.index [ "organization_id" ], name: "index_branches_on_organization_id"
    end
    add_foreign_key :branches, :organizations
    add_column :journal_entries, :branch_id, :bigint
    add_foreign_key :journal_entries, :branches
  end
end
