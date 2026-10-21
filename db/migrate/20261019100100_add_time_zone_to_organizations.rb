class AddTimeZoneToOrganizations < ActiveRecord::Migration[8.0]
  def change
    # IANA identifier, e.g. "Asia/Tehran". Used for scheduled jobs such as
    # automatic currency revaluation ("every day" means the organization's day).
    add_column :organizations, :time_zone, :string, null: false, default: "UTC"
  end
end
