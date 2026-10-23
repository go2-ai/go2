# The default template of a report, for a whole organization (member_id NULL)
# or for one member. It can be any template the organization can see,
# including system templates, so it replaces report_templates.is_default.
class CreateReportDefaults < ActiveRecord::Migration[8.0]
  def up
    create_table :report_defaults do |t|
      t.references :organization, null: false, foreign_key: { on_delete: :cascade }
      t.references :member, null: true, foreign_key: { on_delete: :cascade }
      t.string :report_key, null: false
      t.references :report_template, null: false, foreign_key: { on_delete: :cascade }
      t.timestamps
    end

    add_index :report_defaults, [ :organization_id, :report_key ],
              unique: true,
              where: "member_id IS NULL",
              name: "idx_report_defaults_organization_unique"
    add_index :report_defaults, [ :member_id, :report_key ],
              unique: true,
              where: "member_id IS NOT NULL",
              name: "idx_report_defaults_member_unique"

    # Organization templates marked as default become organization defaults.
    execute <<~SQL
      INSERT INTO report_defaults (organization_id, member_id, report_key, report_template_id, created_at, updated_at)
      SELECT organization_id, NULL, report_key, id, NOW(), NOW()
      FROM report_templates
      WHERE organization_id IS NOT NULL AND is_default = true
    SQL

    remove_index :report_templates, name: "idx_report_templates_org_default_unique"
    remove_column :report_templates, :is_default
  end

  def down
    add_column :report_templates, :is_default, :boolean, default: false, null: false

    # System templates were always the default of their key; organization
    # defaults on organization templates are restored. Personal defaults and
    # organization defaults on system templates are lost.
    execute "UPDATE report_templates SET is_default = true WHERE organization_id IS NULL"
    execute <<~SQL
      UPDATE report_templates SET is_default = true
      FROM report_defaults
      WHERE report_defaults.report_template_id = report_templates.id
        AND report_defaults.member_id IS NULL
        AND report_templates.organization_id IS NOT NULL
    SQL

    add_index :report_templates, [ :organization_id, :report_key ],
              unique: true,
              where: "organization_id IS NOT NULL AND is_default = true",
              name: "idx_report_templates_org_default_unique"

    drop_table :report_defaults
  end
end
