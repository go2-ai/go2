# db/migrate/YYYYMMDDHHMMSS_create_ai_chats.rb
class CreateAiChats < ActiveRecord::Migration[8.0]
  def change
    create_table :ai_chats do |t|
      t.references :organization, null: false, foreign_key: true
      t.references :member, null: false, foreign_key: true

      # What kind of AI feature this chat belongs to.
      # Examples: "chart_of_accounts", "journal_entry_assist", "report_explain"
      t.string :kind, null: false

      # Optional polymorphic subject for record-scoped chats
      # (nil for org-scoped chats like chart_of_accounts).
      t.string :subject_type
      t.bigint :subject_id

      # Feature-specific scratch pad. For chart_of_accounts this holds
      # { catalog_key:, proposal: {...}, validation_errors: [...], ... }.
      # Serialized as JSONB so it can hold anything and be indexed later.
      t.jsonb :state, null: false, default: {}

      # open / accepted / abandoned
      t.string :status, null: false, default: "open"

      t.datetime :last_message_at
      t.datetime :abandoned_at

      t.timestamps
    end

    add_index :ai_chats, [ :organization_id, :member_id, :kind, :status ], unique: true,
              name: "index_ai_chats_on_owner_kind_status"
    add_index :ai_chats, [ :subject_type, :subject_id ],
              name: "index_ai_chats_on_subject"
    add_index :ai_chats, :last_message_at
  end
end
