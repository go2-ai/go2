class AddClosingFieldsToFiscalYears < ActiveRecord::Migration[8.0]
  def change
    change_table :fiscal_years, bulk: true do |t|
      # open: 0, closing: 1, closed: 2
      t.integer :status, null: false, default: 0
      # Current step of the closing wizard; null while the year is open.
      t.integer :closing_step
      # Snapshot of the closing method and accounts taken when closing
      # starts, plus user acknowledgments made in the wizard.
      t.jsonb :closing_data, null: false, default: {}
      t.datetime :closing_started_at
      t.references :closing_started_by, foreign_key: { to_table: :members }, index: true
      t.datetime :closed_at
      t.references :closed_by, foreign_key: { to_table: :members }, index: true
      t.index :status
    end
  end
end
