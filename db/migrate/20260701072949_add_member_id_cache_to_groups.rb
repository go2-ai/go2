class AddMemberIdCacheToGroups < ActiveRecord::Migration[8.0]
  def change
    add_column :groups, :member_id_cache, :jsonb, default: [], null: false
  end
end
