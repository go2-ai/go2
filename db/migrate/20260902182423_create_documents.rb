class CreateDocuments < ActiveRecord::Migration[8.0]
  def change
    create_table :documents do |t|
      t.references :organization, null: false, foreign_key: true
      t.references :documentable, polymorphic: true, null: false
      t.references :member, null: true, foreign_key: true
      t.timestamps
    end
  end
end