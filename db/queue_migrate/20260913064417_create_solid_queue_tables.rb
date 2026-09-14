class CreateSolidQueueTables < ActiveRecord::Migration[8.0]
  def change
    load Rails.root.join("db", "queue_schema.rb")
  end
end
