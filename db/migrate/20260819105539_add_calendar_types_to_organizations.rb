class AddCalendarTypesToOrganizations < ActiveRecord::Migration[8.0]
  def up
    add_column :organizations, :calendar_types, :string, array: true, default: [ 'gregorian' ], null: false
  end

  def down
    remove_column :organizations, :calendar_types
  end
end
