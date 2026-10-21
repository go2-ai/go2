class AddClosingAndFxAccounts < ActiveRecord::Migration[8.0]
  def change
    change_table :accounting_settings, bulk: true do |t|
      # direct: 0, income_summary: 1, current_year_profit: 2
      t.integer :closing_method, null: false, default: 0
      t.references :retained_earnings_account, foreign_key: { to_table: :accounts, on_delete: :nullify }
      t.references :income_summary_account, foreign_key: { to_table: :accounts, on_delete: :nullify }
      t.references :current_year_profit_account, foreign_key: { to_table: :accounts, on_delete: :nullify }
      t.references :default_fx_gain_account, foreign_key: { to_table: :accounts, on_delete: :nullify }
      t.references :default_fx_loss_account, foreign_key: { to_table: :accounts, on_delete: :nullify }
    end

    # Overrides of the FX gain/loss accounts used when revaluing balances of
    # the ledger's / account's monetary items (account > ledger > settings).
    %i[ledgers accounts].each do |table|
      change_table table, bulk: true do |t|
        t.references :fx_gain_account, foreign_key: { to_table: :accounts, on_delete: :nullify }
        t.references :fx_loss_account, foreign_key: { to_table: :accounts, on_delete: :nullify }
      end
    end
  end
end
