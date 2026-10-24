class AddCreatedByIndexToReports < ActiveRecord::Migration[8.0]
  # Deleting a member nullifies reports.created_by_id (foreign key): index it.
  def change
    add_index :reports, :created_by_id
  end
end
