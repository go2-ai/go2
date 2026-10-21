class CreateCurrencyRevaluationSchedules < ActiveRecord::Migration[8.0]
  def change
    create_table :currency_revaluation_schedules do |t|
      t.references :organization, null: false, foreign_key: true
      t.string :name, null: false
      # RFC 5545 recurrence rule, e.g. "FREQ=MONTHLY;BYMONTHDAY=-1".
      t.string :rrule, null: false
      # First occurrence; its time of day (in the organization's time zone)
      # is when each run happens. A run revalues as of its local date.
      t.datetime :dtstart, null: false
      t.jsonb :scope, null: false, default: {}
      # temporary: 0, permanent: 1
      t.integer :default_kind, null: false, default: 0
      # What a permanent run does with balances that have unapproved entries:
      # skip: 0 (post nothing), post_temporary: 1, partial: 2 (post the rest).
      t.integer :on_unapproved, null: false, default: 2
      t.boolean :active, null: false, default: true
      t.datetime :next_run_at
      t.datetime :last_run_at
      # posted, no_change, skipped, blocked, failed
      t.string :last_run_status
      # Counts and error keys of the last run (rendered by the UI).
      t.jsonb :last_run_details, null: false, default: {}
      t.references :last_revaluation, foreign_key: { to_table: :currency_revaluations, on_delete: :nullify }
      t.references :created_by, foreign_key: { to_table: :members }
      t.timestamps
    end
    add_index :currency_revaluation_schedules, %i[active next_run_at]

    add_reference :currency_revaluations, :schedule,
                  foreign_key: { to_table: :currency_revaluation_schedules, on_delete: :nullify }
  end
end
