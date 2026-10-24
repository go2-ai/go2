class CreateReports < ActiveRecord::Migration[8.0]
  def change
    # The report catalog of the reporting platform. System reports
    # (organization_id NULL) are presets maintained in code; organizations
    # work on copies (parent_report_id).
    create_table :reports do |t|
      t.references :organization, foreign_key: true
      # Registered report type, e.g. "accounting.statement".
      t.string :report_type, null: false
      # Stable key of system reports, e.g. "ifrs.balance_sheet".
      t.string :key
      t.string :category, null: false
      t.string :standard
      t.string :statement_type
      t.jsonb :name, null: false, default: {}
      t.jsonb :description, null: false, default: {}
      t.jsonb :settings, null: false, default: {}
      t.bigint :parent_report_id
      t.bigint :created_by_id
      # The organization's main report of its statement type (ratios read it).
      t.boolean :primary, null: false, default: false
      t.datetime :archived_at
      t.timestamps
    end
    add_index :reports, :key, unique: true, where: "organization_id IS NULL"
    add_index :reports, :parent_report_id
    add_index :reports, [ :organization_id, :report_type ]
    add_index :reports, [ :organization_id, :statement_type ], unique: true,
              where: "\"primary\" AND archived_at IS NULL AND organization_id IS NOT NULL",
              name: "idx_reports_primary_per_statement_type"
    add_foreign_key :reports, :reports, column: :parent_report_id, on_delete: :nullify
    add_foreign_key :reports, :members, column: :created_by_id, on_delete: :nullify

    # Who may use a report besides the holders of the general permissions.
    create_table :report_grants do |t|
      t.references :organization, null: false, foreign_key: true
      t.references :report, null: false, foreign_key: { on_delete: :cascade }
      t.references :grantee, polymorphic: true, null: false
      t.integer :access, null: false, default: 0
      t.timestamps
    end
    add_index :report_grants, [ :report_id, :grantee_type, :grantee_id ], unique: true,
              name: "idx_report_grants_unique"

    create_table :statement_layouts do |t|
      t.references :report, null: false, foreign_key: { on_delete: :cascade }, index: { unique: true }
      t.jsonb :settings, null: false, default: {}
      t.timestamps
    end

    create_table :statement_lines do |t|
      t.references :statement_layout, null: false, foreign_key: { on_delete: :cascade }
      t.string :key, null: false
      t.bigint :parent_id
      t.integer :position, null: false, default: 0
      t.integer :kind, null: false, default: 1
      t.jsonb :label, null: false, default: {}
      t.integer :normal_side, null: false, default: 0
      t.string :formula
      t.jsonb :style, null: false, default: {}
      t.jsonb :metadata, null: false, default: {}
      t.timestamps
    end
    add_index :statement_lines, [ :statement_layout_id, :key ], unique: true
    add_index :statement_lines, :parent_id
    add_foreign_key :statement_lines, :statement_lines, column: :parent_id, on_delete: :cascade

    create_table :statement_mapping_rules do |t|
      t.references :statement_layout, null: false, foreign_key: { on_delete: :cascade }
      t.references :statement_line, null: false, foreign_key: { on_delete: :cascade }
      t.bigint :opposite_line_id
      t.integer :selector_type, null: false
      t.jsonb :selector, null: false, default: {}
      t.integer :center_level
      t.bigint :center_ids, array: true, null: false, default: []
      t.bigint :center_type_ids, array: true, null: false, default: []
      t.bigint :currency_ids, array: true, null: false, default: []
      t.string :grain, null: false, default: "account"
      t.string :measure, null: false, default: "balance"
      t.integer :priority
      t.integer :position, null: false, default: 0
      t.text :note
      t.timestamps
    end
    add_index :statement_mapping_rules, :opposite_line_id
    add_foreign_key :statement_mapping_rules, :statement_lines, column: :opposite_line_id, on_delete: :nullify
  end
end
