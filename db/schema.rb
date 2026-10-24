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

ActiveRecord::Schema[8.0].define(version: 2026_10_24_120000) do
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
    t.integer "closing_method", default: 0, null: false
    t.bigint "retained_earnings_account_id"
    t.bigint "income_summary_account_id"
    t.bigint "current_year_profit_account_id"
    t.bigint "default_fx_gain_account_id"
    t.bigint "default_fx_loss_account_id"
    t.jsonb "revaluation_line_description_template", default: {}, null: false
    t.jsonb "revaluation_counter_line_description_template", default: {}, null: false
    t.jsonb "closing_line_description_templates", default: {}, null: false
    t.index ["current_year_profit_account_id"], name: "index_accounting_settings_on_current_year_profit_account_id"
    t.index ["default_fx_gain_account_id"], name: "index_accounting_settings_on_default_fx_gain_account_id"
    t.index ["default_fx_loss_account_id"], name: "index_accounting_settings_on_default_fx_loss_account_id"
    t.index ["income_summary_account_id"], name: "index_accounting_settings_on_income_summary_account_id"
    t.index ["main_currency_id"], name: "index_accounting_settings_on_main_currency_id"
    t.index ["organization_id"], name: "index_accounting_settings_on_organization_id", unique: true
    t.index ["retained_earnings_account_id"], name: "index_accounting_settings_on_retained_earnings_account_id"
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
    t.bigint "fx_gain_account_id"
    t.bigint "fx_loss_account_id"
    t.index ["contra_for_id"], name: "index_accounts_on_contra_for_id"
    t.index ["fx_gain_account_id"], name: "index_accounts_on_fx_gain_account_id"
    t.index ["fx_loss_account_id"], name: "index_accounts_on_fx_loss_account_id"
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

  create_table "ai_chats", force: :cascade do |t|
    t.bigint "organization_id", null: false
    t.bigint "member_id", null: false
    t.string "kind", null: false
    t.string "subject_type"
    t.bigint "subject_id"
    t.jsonb "state", default: {}, null: false
    t.string "status", default: "open", null: false
    t.datetime "last_message_at"
    t.datetime "abandoned_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index "member_id, kind, COALESCE(subject_type, ''::character varying), COALESCE(subject_id, (0)::bigint)", name: "index_ai_chats_on_owner_kind_subject_open", unique: true, where: "((status)::text = 'open'::text)"
    t.index ["last_message_at"], name: "index_ai_chats_on_last_message_at"
    t.index ["member_id"], name: "index_ai_chats_on_member_id"
    t.index ["organization_id", "member_id", "kind", "status"], name: "index_ai_chats_on_owner_kind_status"
    t.index ["organization_id"], name: "index_ai_chats_on_organization_id"
    t.index ["subject_type", "subject_id"], name: "index_ai_chats_on_subject"
  end

  create_table "ai_messages", force: :cascade do |t|
    t.bigint "ai_chat_id", null: false
    t.bigint "sender_member_id"
    t.string "role", null: false
    t.text "content", default: "", null: false
    t.jsonb "metadata", default: {}, null: false
    t.datetime "created_at", null: false
    t.index ["ai_chat_id", "created_at"], name: "index_ai_messages_on_chat_and_created"
    t.index ["ai_chat_id"], name: "index_ai_messages_on_ai_chat_id"
    t.index ["sender_member_id"], name: "index_ai_messages_on_sender_member_id"
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

  create_table "currency_revaluation_items", force: :cascade do |t|
    t.bigint "currency_revaluation_id", null: false
    t.bigint "account_id", null: false
    t.bigint "center1_id"
    t.bigint "center2_id"
    t.bigint "center3_id"
    t.bigint "center4_id"
    t.bigint "center5_id"
    t.bigint "center6_id"
    t.bigint "currency_id", null: false
    t.decimal "currency_balance", precision: 30, scale: 15, null: false
    t.decimal "book_base_balance", precision: 30, scale: 15, null: false
    t.decimal "rate", precision: 30, scale: 15
    t.date "rate_date"
    t.decimal "revalued_base_balance", precision: 30, scale: 15
    t.decimal "difference", precision: 30, scale: 15, default: "0.0", null: false
    t.bigint "gain_loss_account_id"
    t.boolean "excluded", default: false, null: false
    t.string "excluded_reason"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.boolean "removed", default: false, null: false
    t.index ["account_id"], name: "index_currency_revaluation_items_on_account_id"
    t.index ["center1_id"], name: "index_currency_revaluation_items_on_center1_id"
    t.index ["center2_id"], name: "index_currency_revaluation_items_on_center2_id"
    t.index ["center3_id"], name: "index_currency_revaluation_items_on_center3_id"
    t.index ["center4_id"], name: "index_currency_revaluation_items_on_center4_id"
    t.index ["center5_id"], name: "index_currency_revaluation_items_on_center5_id"
    t.index ["center6_id"], name: "index_currency_revaluation_items_on_center6_id"
    t.index ["currency_id"], name: "index_currency_revaluation_items_on_currency_id"
    t.index ["currency_revaluation_id"], name: "index_currency_revaluation_items_on_currency_revaluation_id"
    t.index ["gain_loss_account_id"], name: "index_currency_revaluation_items_on_gain_loss_account_id"
  end

  create_table "currency_revaluation_schedules", force: :cascade do |t|
    t.bigint "organization_id", null: false
    t.string "name", null: false
    t.string "rrule", null: false
    t.datetime "dtstart", null: false
    t.jsonb "scope", default: {}, null: false
    t.integer "default_kind", default: 0, null: false
    t.integer "on_unapproved", default: 2, null: false
    t.boolean "active", default: true, null: false
    t.datetime "next_run_at"
    t.datetime "last_run_at"
    t.string "last_run_status"
    t.jsonb "last_run_details", default: {}, null: false
    t.bigint "last_revaluation_id"
    t.bigint "created_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["active", "next_run_at"], name: "index_currency_revaluation_schedules_on_active_and_next_run_at"
    t.index ["created_by_id"], name: "index_currency_revaluation_schedules_on_created_by_id"
    t.index ["last_revaluation_id"], name: "index_currency_revaluation_schedules_on_last_revaluation_id"
    t.index ["organization_id"], name: "index_currency_revaluation_schedules_on_organization_id"
  end

  create_table "currency_revaluations", force: :cascade do |t|
    t.bigint "organization_id", null: false
    t.bigint "fiscal_year_id", null: false
    t.date "as_of_date", null: false
    t.integer "kind", default: 0, null: false
    t.integer "status", default: 0, null: false
    t.jsonb "scope", default: {}, null: false
    t.string "checksum"
    t.jsonb "description", default: {}, null: false
    t.bigint "created_by_id"
    t.bigint "posted_by_id"
    t.datetime "posted_at"
    t.datetime "superseded_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.bigint "schedule_id"
    t.jsonb "line_description_template", default: {}, null: false
    t.jsonb "counter_line_description_template", default: {}, null: false
    t.jsonb "removed_keys", default: [], null: false
    t.index ["created_by_id"], name: "index_currency_revaluations_on_created_by_id"
    t.index ["fiscal_year_id"], name: "index_currency_revaluations_on_fiscal_year_id"
    t.index ["organization_id", "fiscal_year_id", "status", "kind"], name: "index_currency_revaluations_lookup"
    t.index ["organization_id"], name: "index_currency_revaluations_on_organization_id"
    t.index ["posted_by_id"], name: "index_currency_revaluations_on_posted_by_id"
    t.index ["schedule_id"], name: "index_currency_revaluations_on_schedule_id"
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

  create_table "documents", force: :cascade do |t|
    t.bigint "organization_id", null: false
    t.string "documentable_type", null: false
    t.bigint "documentable_id", null: false
    t.bigint "member_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["documentable_type", "documentable_id"], name: "index_documents_on_documentable"
    t.index ["member_id"], name: "index_documents_on_member_id"
    t.index ["organization_id"], name: "index_documents_on_organization_id"
  end

  create_table "exchange_rate_sources", force: :cascade do |t|
    t.bigint "organization_id", null: false
    t.bigint "currency_id", null: false
    t.string "provider", default: "manual", null: false
    t.bigint "quote_currency_id"
    t.boolean "active", default: true, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["currency_id"], name: "index_exchange_rate_sources_on_currency_id"
    t.index ["organization_id", "currency_id"], name: "index_exchange_rate_sources_on_organization_id_and_currency_id", unique: true
    t.index ["organization_id"], name: "index_exchange_rate_sources_on_organization_id"
    t.index ["quote_currency_id"], name: "index_exchange_rate_sources_on_quote_currency_id"
  end

  create_table "exchange_rates", force: :cascade do |t|
    t.bigint "organization_id", null: false
    t.bigint "currency_id", null: false
    t.bigint "quote_currency_id"
    t.date "date", null: false
    t.decimal "rate", precision: 30, scale: 15, null: false
    t.string "source", default: "manual", null: false
    t.jsonb "meta", default: {}, null: false
    t.bigint "created_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_by_id"], name: "index_exchange_rates_on_created_by_id"
    t.index ["currency_id", "date"], name: "index_exchange_rates_on_currency_id_and_date"
    t.index ["currency_id"], name: "index_exchange_rates_on_currency_id"
    t.index ["organization_id", "currency_id", "date", "source"], name: "index_exchange_rates_uniqueness", unique: true
    t.index ["organization_id"], name: "index_exchange_rates_on_organization_id"
    t.index ["quote_currency_id"], name: "index_exchange_rates_on_quote_currency_id"
  end

  create_table "fiscal_years", force: :cascade do |t|
    t.jsonb "name", default: {}, null: false
    t.date "start_date"
    t.date "finish_date"
    t.bigint "organization_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.integer "status", default: 0, null: false
    t.integer "closing_step"
    t.jsonb "closing_data", default: {}, null: false
    t.datetime "closing_started_at"
    t.bigint "closing_started_by_id"
    t.datetime "closed_at"
    t.bigint "closed_by_id"
    t.index ["closed_by_id"], name: "index_fiscal_years_on_closed_by_id"
    t.index ["closing_started_by_id"], name: "index_fiscal_years_on_closing_started_by_id"
    t.index ["finish_date"], name: "index_fiscal_years_on_finish_date"
    t.index ["name"], name: "index_fiscal_years_on_name", using: :gin
    t.index ["organization_id"], name: "index_fiscal_years_on_organization_id"
    t.index ["start_date"], name: "index_fiscal_years_on_start_date"
    t.index ["status"], name: "index_fiscal_years_on_status"
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
    t.string "no", null: false
    t.string "ref", null: false
    t.integer "daily_no", null: false
    t.integer "state", null: false
    t.integer "entry_type", null: false
    t.jsonb "description", default: {}, null: false
    t.decimal "debit", precision: 30, scale: 15, default: "0.0", null: false
    t.decimal "credit", precision: 30, scale: 15, default: "0.0", null: false
    t.bigint "organization_id", null: false
    t.bigint "creator_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "source_type"
    t.bigint "source_id"
    t.datetime "approved_at"
    t.bigint "approved_by_id"
    t.index ["approved_by_id"], name: "index_journal_entries_on_approved_by_id"
    t.index ["creator_id"], name: "index_journal_entries_on_creator_id"
    t.index ["credit"], name: "index_journal_entries_on_credit"
    t.index ["daily_no"], name: "index_journal_entries_on_daily_no"
    t.index ["debit"], name: "index_journal_entries_on_debit"
    t.index ["description"], name: "index_journal_entries_on_description", using: :gin
    t.index ["entry_type"], name: "index_journal_entries_on_entry_type"
    t.index ["fiscal_year_id"], name: "index_journal_entries_on_fiscal_year_id"
    t.index ["no"], name: "index_journal_entries_on_no"
    t.index ["organization_id", "daily_no", "date"], name: "index_journal_entries_on_organization_id_and_daily_no_and_date"
    t.index ["organization_id", "date"], name: "index_journal_entries_on_organization_id_and_date"
    t.index ["organization_id", "fiscal_year_id", "no"], name: "idx_on_organization_id_fiscal_year_id_no_2a6ed0c132"
    t.index ["organization_id"], name: "index_journal_entries_on_organization_id"
    t.index ["source_type", "source_id"], name: "index_journal_entries_on_source"
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
    t.jsonb "description", default: {}, null: false
    t.decimal "debit", precision: 30, scale: 15, default: "0.0", null: false
    t.decimal "credit", precision: 30, scale: 15, default: "0.0", null: false
    t.bigint "currency_id", null: false
    t.decimal "rate", precision: 30, scale: 15, default: "1.0"
    t.decimal "currency_amount", precision: 30, scale: 15, default: "0.0"
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
    t.index ["journal_entry_id", "row"], name: "index_journal_entry_items_on_journal_entry_id_and_row"
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
    t.bigint "fx_gain_account_id"
    t.bigint "fx_loss_account_id"
    t.index ["account_category_id", "code"], name: "index_ledgers_on_account_category_id_and_code", unique: true
    t.index ["account_category_id"], name: "index_ledgers_on_account_category_id"
    t.index ["contra_for_id"], name: "index_ledgers_on_contra_for_id"
    t.index ["fx_gain_account_id"], name: "index_ledgers_on_fx_gain_account_id"
    t.index ["fx_loss_account_id"], name: "index_ledgers_on_fx_loss_account_id"
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
    t.string "calendar_types", default: ["gregorian"], null: false, array: true
    t.integer "max_file_size", default: 50, null: false
    t.bigint "total_file_size", default: 0, null: false
    t.integer "max_total_file_size", default: 10, null: false
    t.string "time_zone", default: "UTC", null: false
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

  create_table "report_defaults", force: :cascade do |t|
    t.bigint "organization_id", null: false
    t.bigint "member_id"
    t.string "report_key", null: false
    t.bigint "report_template_id", null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["member_id", "report_key"], name: "idx_report_defaults_member_unique", unique: true, where: "(member_id IS NOT NULL)"
    t.index ["member_id"], name: "index_report_defaults_on_member_id"
    t.index ["organization_id", "report_key"], name: "idx_report_defaults_organization_unique", unique: true, where: "(member_id IS NULL)"
    t.index ["organization_id"], name: "index_report_defaults_on_organization_id"
    t.index ["report_template_id"], name: "index_report_defaults_on_report_template_id"
  end

  create_table "report_grants", force: :cascade do |t|
    t.bigint "organization_id", null: false
    t.bigint "report_id", null: false
    t.string "grantee_type", null: false
    t.bigint "grantee_id", null: false
    t.integer "access", default: 0, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["grantee_type", "grantee_id"], name: "index_report_grants_on_grantee"
    t.index ["organization_id"], name: "index_report_grants_on_organization_id"
    t.index ["report_id", "grantee_type", "grantee_id"], name: "idx_report_grants_unique", unique: true
    t.index ["report_id"], name: "index_report_grants_on_report_id"
  end

  create_table "report_templates", force: :cascade do |t|
    t.jsonb "name", default: {}, null: false
    t.string "report_key", null: false
    t.text "template_file", null: false
    t.integer "parent_template_id"
    t.bigint "organization_id"
    t.integer "created_by_id"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "locale", default: "en", null: false
    t.index ["organization_id", "report_key", "locale"], name: "idx_report_templates_org_key_locale"
    t.index ["organization_id"], name: "index_report_templates_on_organization_id"
    t.index ["report_key", "locale"], name: "idx_report_templates_system_unique", unique: true, where: "(organization_id IS NULL)"
  end

  create_table "reports", force: :cascade do |t|
    t.bigint "organization_id"
    t.string "report_type", null: false
    t.string "key"
    t.string "category", null: false
    t.string "standard"
    t.string "statement_type"
    t.jsonb "name", default: {}, null: false
    t.jsonb "description", default: {}, null: false
    t.jsonb "settings", default: {}, null: false
    t.bigint "parent_report_id"
    t.bigint "created_by_id"
    t.boolean "primary", default: false, null: false
    t.datetime "archived_at"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["created_by_id"], name: "index_reports_on_created_by_id"
    t.index ["key"], name: "index_reports_on_key", unique: true, where: "(organization_id IS NULL)"
    t.index ["organization_id", "report_type"], name: "index_reports_on_organization_id_and_report_type"
    t.index ["organization_id", "statement_type"], name: "idx_reports_primary_per_statement_type", unique: true, where: "(\"primary\" AND (archived_at IS NULL) AND (organization_id IS NOT NULL))"
    t.index ["organization_id"], name: "index_reports_on_organization_id"
    t.index ["parent_report_id"], name: "index_reports_on_parent_report_id"
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

  create_table "statement_layouts", force: :cascade do |t|
    t.bigint "report_id", null: false
    t.jsonb "settings", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["report_id"], name: "index_statement_layouts_on_report_id", unique: true
  end

  create_table "statement_lines", force: :cascade do |t|
    t.bigint "statement_layout_id", null: false
    t.string "key", null: false
    t.bigint "parent_id"
    t.integer "position", default: 0, null: false
    t.integer "kind", default: 1, null: false
    t.jsonb "label", default: {}, null: false
    t.integer "normal_side", default: 0, null: false
    t.string "formula"
    t.jsonb "style", default: {}, null: false
    t.jsonb "metadata", default: {}, null: false
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["parent_id"], name: "index_statement_lines_on_parent_id"
    t.index ["statement_layout_id", "key"], name: "index_statement_lines_on_statement_layout_id_and_key", unique: true
    t.index ["statement_layout_id"], name: "index_statement_lines_on_statement_layout_id"
  end

  create_table "statement_mapping_rules", force: :cascade do |t|
    t.bigint "statement_layout_id", null: false
    t.bigint "statement_line_id", null: false
    t.bigint "opposite_line_id"
    t.integer "selector_type", null: false
    t.jsonb "selector", default: {}, null: false
    t.integer "center_level"
    t.bigint "center_ids", default: [], null: false, array: true
    t.bigint "center_type_ids", default: [], null: false, array: true
    t.bigint "currency_ids", default: [], null: false, array: true
    t.string "grain", default: "account", null: false
    t.string "measure", default: "balance", null: false
    t.integer "priority"
    t.integer "position", default: 0, null: false
    t.text "note"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.index ["opposite_line_id"], name: "index_statement_mapping_rules_on_opposite_line_id"
    t.index ["statement_layout_id"], name: "index_statement_mapping_rules_on_statement_layout_id"
    t.index ["statement_line_id"], name: "index_statement_mapping_rules_on_statement_line_id"
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
  add_foreign_key "accounting_settings", "accounts", column: "current_year_profit_account_id", on_delete: :nullify
  add_foreign_key "accounting_settings", "accounts", column: "default_fx_gain_account_id", on_delete: :nullify
  add_foreign_key "accounting_settings", "accounts", column: "default_fx_loss_account_id", on_delete: :nullify
  add_foreign_key "accounting_settings", "accounts", column: "income_summary_account_id", on_delete: :nullify
  add_foreign_key "accounting_settings", "accounts", column: "retained_earnings_account_id", on_delete: :nullify
  add_foreign_key "accounting_settings", "currencies", column: "main_currency_id"
  add_foreign_key "accounting_settings", "organizations"
  add_foreign_key "accounts", "accounts", column: "contra_for_id"
  add_foreign_key "accounts", "accounts", column: "fx_gain_account_id", on_delete: :nullify
  add_foreign_key "accounts", "accounts", column: "fx_loss_account_id", on_delete: :nullify
  add_foreign_key "accounts", "ledgers"
  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "ai_chats", "members"
  add_foreign_key "ai_chats", "organizations"
  add_foreign_key "ai_messages", "ai_chats"
  add_foreign_key "ai_messages", "members", column: "sender_member_id"
  add_foreign_key "center_types", "organizations"
  add_foreign_key "centers", "center_types"
  add_foreign_key "conversation_participants", "conversations"
  add_foreign_key "conversation_participants", "users"
  add_foreign_key "currencies", "organizations"
  add_foreign_key "currency_revaluation_items", "accounts"
  add_foreign_key "currency_revaluation_items", "accounts", column: "gain_loss_account_id"
  add_foreign_key "currency_revaluation_items", "centers", column: "center1_id"
  add_foreign_key "currency_revaluation_items", "centers", column: "center2_id"
  add_foreign_key "currency_revaluation_items", "centers", column: "center3_id"
  add_foreign_key "currency_revaluation_items", "centers", column: "center4_id"
  add_foreign_key "currency_revaluation_items", "centers", column: "center5_id"
  add_foreign_key "currency_revaluation_items", "centers", column: "center6_id"
  add_foreign_key "currency_revaluation_items", "currencies"
  add_foreign_key "currency_revaluation_items", "currency_revaluations"
  add_foreign_key "currency_revaluation_schedules", "currency_revaluations", column: "last_revaluation_id", on_delete: :nullify
  add_foreign_key "currency_revaluation_schedules", "members", column: "created_by_id"
  add_foreign_key "currency_revaluation_schedules", "organizations"
  add_foreign_key "currency_revaluations", "currency_revaluation_schedules", column: "schedule_id", on_delete: :nullify
  add_foreign_key "currency_revaluations", "fiscal_years"
  add_foreign_key "currency_revaluations", "members", column: "created_by_id"
  add_foreign_key "currency_revaluations", "members", column: "posted_by_id"
  add_foreign_key "currency_revaluations", "organizations"
  add_foreign_key "departments", "organizations"
  add_foreign_key "documents", "members"
  add_foreign_key "documents", "organizations"
  add_foreign_key "exchange_rate_sources", "currencies"
  add_foreign_key "exchange_rate_sources", "currencies", column: "quote_currency_id"
  add_foreign_key "exchange_rate_sources", "organizations"
  add_foreign_key "exchange_rates", "currencies"
  add_foreign_key "exchange_rates", "currencies", column: "quote_currency_id"
  add_foreign_key "exchange_rates", "members", column: "created_by_id"
  add_foreign_key "exchange_rates", "organizations"
  add_foreign_key "fiscal_years", "members", column: "closed_by_id"
  add_foreign_key "fiscal_years", "members", column: "closing_started_by_id"
  add_foreign_key "fiscal_years", "organizations"
  add_foreign_key "groups", "organizations"
  add_foreign_key "journal_entries", "fiscal_years"
  add_foreign_key "journal_entries", "members", column: "approved_by_id"
  add_foreign_key "journal_entries", "members", column: "creator_id"
  add_foreign_key "journal_entries", "organizations"
  add_foreign_key "journal_entry_items", "accounts"
  add_foreign_key "journal_entry_items", "centers", column: "center1_id"
  add_foreign_key "journal_entry_items", "centers", column: "center2_id"
  add_foreign_key "journal_entry_items", "centers", column: "center3_id"
  add_foreign_key "journal_entry_items", "centers", column: "center4_id"
  add_foreign_key "journal_entry_items", "centers", column: "center5_id"
  add_foreign_key "journal_entry_items", "centers", column: "center6_id"
  add_foreign_key "journal_entry_items", "currencies"
  add_foreign_key "journal_entry_items", "journal_entries"
  add_foreign_key "ledgers", "account_categories"
  add_foreign_key "ledgers", "accounts", column: "fx_gain_account_id", on_delete: :nullify
  add_foreign_key "ledgers", "accounts", column: "fx_loss_account_id", on_delete: :nullify
  add_foreign_key "ledgers", "ledgers", column: "contra_for_id"
  add_foreign_key "members", "organizations"
  add_foreign_key "members", "users"
  add_foreign_key "message_receipts", "messages"
  add_foreign_key "message_receipts", "users"
  add_foreign_key "messages", "conversations"
  add_foreign_key "messages", "messages", column: "reply_to_id"
  add_foreign_key "permissions", "organizations"
  add_foreign_key "report_defaults", "members", on_delete: :cascade
  add_foreign_key "report_defaults", "organizations", on_delete: :cascade
  add_foreign_key "report_defaults", "report_templates", on_delete: :cascade
  add_foreign_key "report_grants", "organizations"
  add_foreign_key "report_grants", "reports", on_delete: :cascade
  add_foreign_key "report_templates", "members", column: "created_by_id"
  add_foreign_key "report_templates", "organizations"
  add_foreign_key "reports", "members", column: "created_by_id", on_delete: :nullify
  add_foreign_key "reports", "organizations"
  add_foreign_key "reports", "reports", column: "parent_report_id", on_delete: :nullify
  add_foreign_key "roles", "departments"
  add_foreign_key "roles", "members"
  add_foreign_key "roles", "organizations"
  add_foreign_key "statement_layouts", "reports", on_delete: :cascade
  add_foreign_key "statement_lines", "statement_layouts", on_delete: :cascade
  add_foreign_key "statement_lines", "statement_lines", column: "parent_id", on_delete: :cascade
  add_foreign_key "statement_mapping_rules", "statement_layouts", on_delete: :cascade
  add_foreign_key "statement_mapping_rules", "statement_lines", column: "opposite_line_id", on_delete: :nullify
  add_foreign_key "statement_mapping_rules", "statement_lines", on_delete: :cascade
  add_foreign_key "tasks", "organizations"
  add_foreign_key "tasks", "users"
end
