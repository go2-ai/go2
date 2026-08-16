class AddSystemToAccountCategories < ActiveRecord::Migration[8.0]
  def change
    add_column :account_categories, :identifier, :string
    add_index :account_categories, :identifier
  end
end
