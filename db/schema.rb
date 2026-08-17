# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.0].define(version: 2026_08_17_182910) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "account_categories", force: :cascade do |t|
    t.string "code", null: false
    t.jsonb "name", default: {}, null: false
    t.integer "type", null: false
    t.bigint "organization_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "identifier"
    t.index ["code"], name: "index_account_categories_on_code"
    t.index ["identifier"], name: "index_account_categories_on_identifier"
    t.index ["name"], name: "index_account_categories_on_name", using: :gin
    t.index ["organization_id"], name: "index_account_categories_on_organization_id"
  end

  create_table "accounting_settings", force: :cascade do |t|
    t.bigint "organization_id", null: false
    t.bigint "main_currency_id"
    t.boolean "use_parent_org_currencies", default: false
    t.boolean "use_parent_org_accounts", default: false
    t.boolean "use_parent_org_centers", default: false
    t.boolean "use_parent_org_fiscal_years", default: false
    t.integer "account_category_length", default: 1
    t.integer "ledger_length", default: 2
    t.integer "account_length", default: 2
    t.integer "center_length", default: 6
    t.integer "center_levels", default: 3
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["main_currency_id"], name: "index_accounting_settings_on_main_currency_id"
    t.index ["organization_id"], name: "index_accounting_settings_on_organization_id", unique: true
  end

  create_table "accounts", force: :cascade do |t|
    t.bigint "ledger_id", null: false
    t.string "code", null: false
    t.jsonb "name", default: {}, null: false
    t.bigint "contra_for_id"
    t.boolean "accepts_other_currencies", null: false
    t.integer "allowed_center_types_1", array: true
    t.integer "allowed_center_types_2", array: true
    t.integer "allowed_center_types_3", array: true
    t.integer "allowed_center_types_4", array: true
    t.integer "allowed_center_types_5", array: true
    t.integer "allowed_center_types_6", array: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["contra_for_id"], name: "index_accounts_on_contra_for_id"
    t.index ["ledger_id", "code"], name: "index_accounts_on_ledger_id_and_code", unique: true
    t.index ["ledger_id"], name: "index_accounts_on_ledger_id"
  end

  create_table "active_storage_attachments", force: :cascade do |t|
    t.string "name", null: false
    t.string "record_type", null: false
    t.bigint "record_id", null: false
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.string "key", null: false
    t.string "filename", null: false
    t.string "content_type"
    t.text "metadata"
    t.string "service_name", null: false
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.datetime "created_at", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "branches", force: :cascade do |t|
    t.jsonb "name"
    t.string "code"
    t.bigint "organization_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["code"], name: "index_branches_on_code"
    t.index ["name"], name: "index_branches_on_name", using: :gin
    t.index ["organization_id"], name: "index_branches_on_organization_id"
  end

  create_table "center_types", force: :cascade do |t|
    t.bigint "organization_id", null: false
    t.jsonb "name", default: {}, null: false
    t.string "first_code", null: false
    t.string "last_code", null: false
    t.boolean "auto_increment", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "metadata", default: [], null: false
    t.index ["name"], name: "index_center_types_on_name", using: :gin
    t.index ["organization_id"], name: "index_center_types_on_organization_id"
  end

  create_table "centers", force: :cascade do |t|
    t.bigint "center_type_id", null: false
    t.string "code", null: false
    t.jsonb "name", default: {}, null: false
    t.string "centerable_type"
    t.integer "centerable_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "metadata", default: {}, null: false
    t.index ["center_type_id"], name: "index_centers_on_center_type_id"
    t.index ["code"], name: "index_centers_on_code"
    t.index ["name"], name: "index_centers_on_name", using: :gin
  end

  create_table "conversation_participants", force: :cascade do |t|
    t.bigint "conversation_id", null: false
    t.bigint "user_id", null: false
    t.datetime "joined_at", null: false
    t.boolean "include_past_messages", default: false
    t.datetime "left_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["conversation_id", "user_id"], name: "index_conversation_participants_on_conversation_id_and_user_id", unique: true
    t.index ["conversation_id"], name: "index_conversation_participants_on_conversation_id"
    t.index ["user_id"], name: "index_conversation_participants_on_user_id"
  end

  create_table "conversations", force: :cascade do |t|
    t.boolean "is_group", default: false, null: false
    t.string "name"
    t.bigint "organization_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["organization_id"], name: "index_conversations_on_organization_id"
  end

  create_table "currencies", force: :cascade do |t|
    t.jsonb "name", default: {}, null: false
    t.string "abr"
    t.integer "decimal_digits"
    t.bigint "organization_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["abr"], name: "index_currencies_on_abr"
    t.index ["name"], name: "index_currencies_on_name", using: :gin
    t.index ["organization_id"], name: "index_currencies_on_organization_id"
  end

  create_table "departments", force: :cascade do |t|
    t.jsonb "name", default: {}, null: false
    t.jsonb "description", default: {}
    t.string "abbreviation"
    t.bigint "organization_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["name"], name: "index_departments_on_name", using: :gin
    t.index ["organization_id"], name: "index_departments_on_organization_id"
  end

  create_table "fiscal_years", force: :cascade do |t|
    t.jsonb "name"
    t.date "start_date"
    t.date "finish_date"
    t.bigint "organization_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["finish_date"], name: "index_fiscal_years_on_finish_date"
    t.index ["name"], name: "index_fiscal_years_on_name", using: :gin
    t.index ["organization_id"], name: "index_fiscal_years_on_organization_id"
    t.index ["start_date"], name: "index_fiscal_years_on_start_date"
  end

  create_table "groups", force: :cascade do |t|
    t.jsonb "name", default: {}, null: false
    t.jsonb "description", default: {}
    t.bigint "organization_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.jsonb "member_id_cache", default: [], null: false
    t.index ["name"], name: "index_groups_on_name", using: :gin
    t.index ["organization_id"], name: "index_groups_on_organization_id"
  end

  create_table "groups_members", force: :cascade do |t|
    t.bigint "group_id", null: false
    t.bigint "member_id", null: false
  end

  create_table "journal_entries", force: :cascade do |t|
    t.date "date", null: false
    t.date "effective_date", null: false
    t.bigint "fiscal_year_id", null: false
    t.bigint "branch_id", null: false
    t.string "no", null: false
    t.string "ref", null: false
    t.integer "daily_no", null: false
    t.integer "state", null: false
    t.integer "entry_type", null: false
    t.jsonb "description"
    t.float "debit"
    t.float "credit"
    t.bigint "organization_id", null: false
    t.bigint "creator_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["branch_id"], name: "index_journal_entries_on_branch_id"
    t.index ["creator_id"], name: "index_journal_entries_on_creator_id"
    t.index ["credit"], name: "index_journal_entries_on_credit"
    t.index ["daily_no"], name: "index_journal_entries_on_daily_no"
    t.index ["debit"], name: "index_journal_entries_on_debit"
    t.index ["description"], name: "index_journal_entries_on_description", using: :gin
    t.index ["entry_type"], name: "index_journal_entries_on_entry_type"
    t.index ["fiscal_year_id"], name: "index_journal_entries_on_fiscal_year_id"
    t.index ["no"], name: "index_journal_entries_on_no"
    t.index ["organization_id"], name: "index_journal_entries_on_organization_id"
    t.index ["state"], name: "index_journal_entries_on_state"
  end

  create_table "journal_entry_items", force: :cascade do |t|
    t.bigint "journal_entry_id", null: false
    t.integer "row", null: false
    t.bigint "account_id"
    t.bigint "center1_id"
    t.bigint "center2_id"
    t.bigint "center3_id"
    t.bigint "center4_id"
    t.bigint "center5_id"
    t.bigint "center6_id"
    t.jsonb "description"
    t.float "debit"
    t.float "credit"
    t.bigint "currency_id", null: false
    t.float "rate"
    t.float "currency_amount"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_id"], name: "index_journal_entry_items_on_account_id"
    t.index ["center1_id"], name: "index_journal_entry_items_on_center1_id"
    t.index ["center2_id"], name: "index_journal_entry_items_on_center2_id"
    t.index ["center3_id"], name: "index_journal_entry_items_on_center3_id"
    t.index ["center4_id"], name: "index_journal_entry_items_on_center4_id"
    t.index ["center5_id"], name: "index_journal_entry_items_on_center5_id"
    t.index ["center6_id"], name: "index_journal_entry_items_on_center6_id"
    t.index ["credit"], name: "index_journal_entry_items_on_credit"
    t.index ["currency_amount"], name: "index_journal_entry_items_on_currency_amount"
    t.index ["currency_id"], name: "index_journal_entry_items_on_currency_id"
    t.index ["debit"], name: "index_journal_entry_items_on_debit"
    t.index ["journal_entry_id"], name: "index_journal_entry_items_on_journal_entry_id"
    t.index ["rate"], name: "index_journal_entry_items_on_rate"
  end

  create_table "ledgers", force: :cascade do |t|
    t.bigint "account_category_id", null: false
    t.string "code", null: false
    t.jsonb "name", default: {}, null: false
    t.bigint "contra_for_id"
    t.integer "unexpected_balance", null: false
    t.boolean "is_monetary", default: false, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["account_category_id", "code"], name: "index_ledgers_on_account_category_id_and_code", unique: true
    t.index ["account_category_id"], name: "index_ledgers_on_account_category_id"
    t.index ["contra_for_id"], name: "index_ledgers_on_contra_for_id"
  end

  create_table "members", force: :cascade do |t|
    t.string "email", null: false
    t.jsonb "name", default: {}, null: false
    t.bigint "organization_id", null: false
    t.bigint "user_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.datetime "invited_at"
    t.string "invitation_key"
    t.datetime "joined_at"
    t.string "archive_number"
    t.datetime "archived_at"
    t.string "initial"
    t.string "color"
    t.index ["email"], name: "index_members_on_email"
    t.index ["name"], name: "index_members_on_name", using: :gin
    t.index ["organization_id"], name: "index_members_on_organization_id"
    t.index ["user_id"], name: "index_members_on_user_id"
  end

  create_table "message_receipts", force: :cascade do |t|
    t.bigint "message_id", null: false
    t.bigint "user_id", null: false
    t.datetime "read_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["message_id"], name: "index_message_receipts_on_message_id"
    t.index ["user_id"], name: "index_message_receipts_on_user_id"
  end

  create_table "messages", force: :cascade do |t|
    t.bigint "conversation_id", null: false
    t.string "sender_type", null: false
    t.bigint "sender_id", null: false
    t.text "body"
    t.bigint "reply_to_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["conversation_id"], name: "index_messages_on_conversation_id"
    t.index ["reply_to_id"], name: "index_messages_on_reply_to_id"
    t.index ["sender_type", "sender_id"], name: "index_messages_on_sender"
  end

  create_table "organizations", force: :cascade do |t|
    t.jsonb "name", default: {}, null: false
    t.jsonb "description", default: {}, null: false
    t.integer "parent_id"
    t.boolean "is_tenant"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "is_trial", default: false
    t.datetime "archived_at"
    t.integer "archive_number"
    t.string "locale", default: "en", null: false
    t.string "active_locales", default: [], null: false, array: true
    t.string "inactive_locales", default: [], null: false, array: true
    t.index ["archived_at"], name: "index_organizations_on_archived_at"
    t.index ["name"], name: "index_organizations_on_name", using: :gin
    t.index ["parent_id"], name: "index_organizations_on_parent_id"
  end

  create_table "permissions", force: :cascade do |t|
    t.string "code", null: false
    t.string "grantee_type", null: false
    t.bigint "grantee_id", null: false
    t.bigint "organization_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["code", "grantee_type", "grantee_id"], name: "index_permissions_on_code_and_grantee", unique: true
    t.index ["code"], name: "index_permissions_on_code"
    t.index ["grantee_id"], name: "index_permissions_on_grantee_id"
    t.index ["grantee_type", "grantee_id"], name: "index_permissions_on_grantee_type_and_grantee_id"
    t.index ["grantee_type"], name: "index_permissions_on_grantee_type"
    t.index ["organization_id"], name: "index_permissions_on_organization_id"
  end

  create_table "roles", force: :cascade do |t|
    t.jsonb "name", default: {}, null: false
    t.jsonb "description", default: {}
    t.integer "parent_id"
    t.bigint "organization_id", null: false
    t.bigint "department_id"
    t.boolean "active", default: true
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "member_id"
    t.index ["department_id"], name: "index_roles_on_department_id"
    t.index ["member_id"], name: "index_roles_on_member_id"
    t.index ["name"], name: "index_roles_on_name", using: :gin
    t.index ["organization_id"], name: "index_roles_on_organization_id"
    t.index ["parent_id"], name: "index_roles_on_parent_id"
  end

  create_table "tasks", force: :cascade do |t|
    t.string "title", null: false
    t.text "description"
    t.string "status", default: "pending"
    t.string "priority", default: "medium"
    t.string "category", default: "general"
    t.datetime "due_date"
    t.datetime "completed_at"
    t.bigint "user_id", null: false
    t.bigint "organization_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["category"], name: "index_tasks_on_category"
    t.index ["due_date"], name: "index_tasks_on_due_date"
    t.index ["organization_id"], name: "index_tasks_on_organization_id"
    t.index ["status", "priority"], name: "index_tasks_on_status_and_priority"
    t.index ["user_id"], name: "index_tasks_on_user_id"
  end

  create_table "users", force: :cascade do |t|
    t.string "email", default: "", null: false
    t.string "encrypted_password", default: "", null: false
    t.string "reset_password_token"
    t.datetime "reset_password_sent_at"
    t.datetime "remember_created_at"
    t.integer "sign_in_count", default: 0, null: false
    t.datetime "current_sign_in_at"
    t.datetime "last_sign_in_at"
    t.string "current_sign_in_ip"
    t.string "last_sign_in_ip"
    t.string "confirmation_token"
    t.datetime "confirmed_at"
    t.datetime "confirmation_sent_at"
    t.string "unconfirmed_email"
    t.integer "failed_attempts", default: 0, null: false
    t.string "unlock_token"
    t.datetime "locked_at"
    t.string "provider"
    t.string "uid"
    t.string "otp_secret"
    t.boolean "otp_required_for_login", default: false
    t.boolean "otp_verified", default: false
    t.integer "consumed_timestep"
    t.string "otp_backup_codes"
    t.string "phone_number"
    t.boolean "phone_verified", default: false
    t.string "first_name"
    t.string "last_name"
    t.string "job_title"
    t.date "birth_date"
    t.string "avatar"
    t.string "timezone"
    t.jsonb "preferences", default: {}, null: false
    t.boolean "active", default: true
    t.datetime "deactivated_at"
    t.datetime "password_changed_at"
    t.string "security_audit_log"
    t.string "last_activity_type"
    t.datetime "last_activity_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.text "address"
    t.string "locale", default: "en"
    t.string "role"
    t.boolean "use_tabbed_navigation", default: true
    t.index ["active"], name: "index_users_on_active"
    t.index ["confirmation_token"], name: "index_users_on_confirmation_token", unique: true
    t.index ["email"], name: "index_users_on_email", unique: true
    t.index ["first_name", "last_name"], name: "index_users_on_first_name_and_last_name"
    t.index ["locale"], name: "index_users_on_locale"
    t.index ["otp_secret"], name: "index_users_on_otp_secret", unique: true
    t.index ["phone_number"], name: "index_users_on_phone_number"
    t.index ["provider", "uid"], name: "index_users_on_provider_and_uid", unique: true, where: "((provider IS NOT NULL) AND (uid IS NOT NULL))"
    t.index ["reset_password_token"], name: "index_users_on_reset_password_token", unique: true
    t.index ["role"], name: "index_users_on_role"
    t.index ["unlock_token"], name: "index_users_on_unlock_token", unique: true
  end

  create_table "versions", force: :cascade do |t|
    t.string "whodunnit"
    t.datetime "created_at"
    t.bigint "item_id", null: false
    t.string "item_type", null: false
    t.string "event", null: false
    t.text "object"
    t.jsonb "object_changes"
    t.jsonb "metadata", default: {}, null: false
    t.index ["item_type", "item_id"], name: "index_versions_on_item_type_and_item_id"
    t.index ["metadata"], name: "index_versions_on_metadata", using: :gin
  end

  add_foreign_key "account_categories", "organizations"
  add_foreign_key "accounting_settings", "currencies", column: "main_currency_id"
  add_foreign_key "accounting_settings", "organizations"
  add_foreign_key "accounts", "accounts", column: "contra_for_id"
  add_foreign_key "accounts", "ledgers"
  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "branches", "organizations"
  add_foreign_key "center_types", "organizations"
  add_foreign_key "centers", "center_types"
  add_foreign_key "conversation_participants", "conversations"
  add_foreign_key "conversation_participants", "users"
  add_foreign_key "currencies", "organizations"
  add_foreign_key "departments", "organizations"
  add_foreign_key "fiscal_years", "organizations"
  add_foreign_key "groups", "organizations"
  add_foreign_key "journal_entries", "branches"
  add_foreign_key "journal_entries", "fiscal_years"
  add_foreign_key "journal_entries", "members", column: "creator_id"
  add_foreign_key "journal_entries", "organizations"
  add_foreign_key "journal_entry_items", "centers", column: "account_id"
  add_foreign_key "journal_entry_items", "centers", column: "center1_id"
  add_foreign_key "journal_entry_items", "centers", column: "center2_id"
  add_foreign_key "journal_entry_items", "centers", column: "center3_id"
  add_foreign_key "journal_entry_items", "centers", column: "center4_id"
  add_foreign_key "journal_entry_items", "centers", column: "center5_id"
  add_foreign_key "journal_entry_items", "centers", column: "center6_id"
  add_foreign_key "journal_entry_items", "currencies"
  add_foreign_key "journal_entry_items", "journal_entries"
  add_foreign_key "ledgers", "account_categories"
  add_foreign_key "ledgers", "ledgers", column: "contra_for_id"
  add_foreign_key "members", "organizations"
  add_foreign_key "members", "users"
  add_foreign_key "message_receipts", "messages"
  add_foreign_key "message_receipts", "users"
  add_foreign_key "messages", "conversations"
  add_foreign_key "messages", "messages", column: "reply_to_id"
  add_foreign_key "permissions", "organizations"
  add_foreign_key "roles", "departments"
  add_foreign_key "roles", "members"
  add_foreign_key "roles", "organizations"
  add_foreign_key "tasks", "organizations"
  add_foreign_key "tasks", "users"
end
