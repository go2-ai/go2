# db/migrate/YYYYMMDDHHMMSS_create_ai_messages.rb
class CreateAiMessages < ActiveRecord::Migration[8.0]
  def change
    create_table :ai_messages do |t|
      t.references :ai_chat, null: false, foreign_key: true

      # Nullable: assistant and tool messages have no human sender.
      t.references :sender_member, null: true, foreign_key: { to_table: :members }

      # "user" | "assistant" | "tool"
      t.string :role, null: false

      t.text :content, null: false, default: ""

      # Per-message metadata: attachments [{ document_id: 7 }],
      # tool calls [{ name:, input:, output: }], validation errors, etc.
      t.jsonb :metadata, null: false, default: {}

      t.datetime :created_at, null: false
    end

    add_index :ai_messages, [ :ai_chat_id, :created_at ],
              name: "index_ai_messages_on_chat_and_created"
  end
end
