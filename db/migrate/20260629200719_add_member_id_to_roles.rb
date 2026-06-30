class AddMemberIdToRoles < ActiveRecord::Migration[8.0]
  def change
    drop_table :role_assignments
    add_reference :roles, :member, foreign_key: true, index: true
  end
end
