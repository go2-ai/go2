class CreateReportTemplates < ActiveRecord::Migration[8.0]
  def change
    create_table :report_templates do |t|
      t.jsonb :name, default: {}, null: false
      t.string :report_key, null: false
      t.text :template_file, null: false
      t.integer :parent_template_id
      t.references :organization, null: true, foreign_key: true
      t.integer :created_by_id
      t.boolean :is_default, default: false, null: false

      t.timestamps
    end

    add_foreign_key :report_templates, :members, column: :created_by_id

    add_index :report_templates, [ :organization_id, :report_key ],
              unique: true,
              where: "organization_id IS NOT NULL AND is_default = true",
              name: "idx_report_templates_org_default_unique"

    add_index :report_templates, [ :report_key ],
              unique: true,
              where: "organization_id IS NULL",
              name: "idx_report_templates_system_unique"
  end
end
