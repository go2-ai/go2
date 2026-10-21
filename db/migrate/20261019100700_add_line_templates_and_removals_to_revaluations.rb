# Descriptions of revaluation entry lines come from templates (per locale);
# users can leave combinations out of a revaluation and bring them back.
class AddLineTemplatesAndRemovalsToRevaluations < ActiveRecord::Migration[8.0]
  def change
    change_table :currency_revaluations, bulk: true do |t|
      # { "en" => "...", "fa" => "..." }; blank locales use the organization default.
      t.jsonb :line_description_template, null: false, default: {}
      t.jsonb :counter_line_description_template, null: false, default: {}
      # Keys ([account_id, center1_id..center6_id, currency_id]) the user left out;
      # kept across rebuilds of the preview.
      t.jsonb :removed_keys, null: false, default: []
    end

    add_column :currency_revaluation_items, :removed, :boolean, null: false, default: false

    change_table :accounting_settings, bulk: true do |t|
      # Organization defaults; blank locales use the built-in templates.
      t.jsonb :revaluation_line_description_template, null: false, default: {}
      t.jsonb :revaluation_counter_line_description_template, null: false, default: {}
    end
  end
end
