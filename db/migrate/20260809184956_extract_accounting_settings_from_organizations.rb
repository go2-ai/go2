class ExtractAccountingSettingsFromOrganizations < ActiveRecord::Migration[8.0]
  def change
    create_table :accounting_settings do |t|
      t.references :organization, null: false, foreign_key: true, index: { unique: true }
      t.references :main_currency, foreign_key: { to_table: :currencies }
      t.boolean "use_parent_org_currencies", default: false
      t.boolean "use_parent_org_accounts", default: false
      t.boolean "use_parent_org_centers", default: false
      t.boolean "use_parent_org_fiscal_years", default: false
      t.integer "account_category_length", default: 1
      t.integer "ledger_length", default: 2
      t.integer "account_length", default: 2
      t.integer "center_length", default: 6
      t.integer "center_levels", default: 3

      t.timestamps
    end

    remove_column :organizations, :main_currency_id, :bigint
    remove_column :organizations, :use_parent_org_currencies, :boolean, default: false
    remove_column :organizations, :use_parent_org_accounts, :boolean, default: false
    remove_column :organizations, :use_parent_org_centers, :boolean, default: false
    remove_column :organizations, :use_parent_org_fiscal_years, :boolean, default: false
    remove_column :organizations, :account_category_length, :integer, default: 1
    remove_column :organizations, :account_length, :integer, default: 2
    remove_column :organizations, :ledger_length, :integer, default: 2
    remove_column :organizations, :center_length, :integer, default: 6
    remove_column :organizations, :center_levels, :integer, default: 3
  end
end
