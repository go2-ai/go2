# Organization defaults for the line descriptions of closing entries:
# { kind => { locale => template } } (see Accounting::Closing::LineDescriptions).
class AddClosingLineTemplatesToAccountingSettings < ActiveRecord::Migration[8.0]
  def change
    add_column :accounting_settings, :closing_line_description_templates, :jsonb, null: false, default: {}
  end
end
