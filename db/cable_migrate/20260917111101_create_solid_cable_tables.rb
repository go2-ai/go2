# frozen_string_literal: true

# Creates the Solid Cable tables. Solid Cable ships its own schema file
# (installed by the solid_cable gem); loading it here — rather than
# requiring a separate `db:cable:migrate` command — keeps migration
# state in one place, the same way CreateSolidQueueTables does for the
# queue database.
class CreateSolidCableTables < ActiveRecord::Migration[8.0]
  def change
    load Rails.root.join("db", "cable_schema.rb")
  end
end