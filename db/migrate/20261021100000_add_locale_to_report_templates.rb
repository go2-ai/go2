# Report templates are written in one language. The system has one template
# per report key and locale; organizations can copy them into any of their
# locales.
class AddLocaleToReportTemplates < ActiveRecord::Migration[8.0]
  def up
    add_column :report_templates, :locale, :string, null: false, default: "en"

    remove_index :report_templates, name: "idx_report_templates_system_unique"
    add_index :report_templates, [ :report_key, :locale ],
              unique: true,
              where: "organization_id IS NULL",
              name: "idx_report_templates_system_unique"
    add_index :report_templates, [ :organization_id, :report_key, :locale ],
              name: "idx_report_templates_org_key_locale"
  end

  def down
    remove_index :report_templates, name: "idx_report_templates_org_key_locale"
    remove_index :report_templates, name: "idx_report_templates_system_unique"
    execute "DELETE FROM report_templates WHERE organization_id IS NULL AND locale <> 'en'"
    add_index :report_templates, [ :report_key ],
              unique: true,
              where: "organization_id IS NULL",
              name: "idx_report_templates_system_unique"

    remove_column :report_templates, :locale
  end
end
