# System report templates (Ariana Reports JSON), one per report key and
# locale. They are owned by the code: running the seeds again updates them to
# the versions in db/seeds/report_templates and the template generators.
journal_entry_name = { "en" => "Journal Entry", "fa" => "سند حسابداری" }
revaluation_name = { "en" => "Revaluation of Monetary Items", "fa" => "تسعیر اقلام پولی" }
explorer_name = { "en" => "Explorer", "fa" => "کاوشگر" }
journal_entry_items_name = { "en" => "Journal Entry Items", "fa" => "آرتیکل‌های سند حسابداری" }
reporting_names = {
  "financial_statement" => { "en" => "Financial Statement", "fa" => "صورت مالی" },
  "trial_balance" => { "en" => "Trial Balance", "fa" => "تراز آزمایشی" },
  "financial_ratios" => { "en" => "Financial Ratios", "fa" => "نسبت‌های مالی" }
}
reporting_generators = {
  "financial_statement" => Accounting::Reports::FinancialStatementTemplate,
  "trial_balance" => Accounting::Reports::TrialBalanceTemplate,
  "financial_ratios" => Accounting::Reports::FinancialRatiosTemplate
}

report_templates = %w[en fa].flat_map do |locale|
  [
    {
      name: journal_entry_name,
      report_key: "journal_entry",
      locale: locale,
      template_file: File.read(Rails.root.join("db/seeds/report_templates/journal_entry.#{locale}.json"))
    },
    {
      name: revaluation_name,
      report_key: "currency_revaluation",
      locale: locale,
      # Generated per organization when served (center levels); stored with 3.
      template_file: Accounting::Reports::CurrencyRevaluationTemplate.build(center_levels: 3, locale: locale).to_json
    },
    {
      name: explorer_name,
      report_key: "explorer",
      locale: locale,
      # Generated per organization when served (main currency decimals).
      template_file: Accounting::Reports::ExplorerTemplate.build(locale: locale).to_json
    },
    {
      name: journal_entry_items_name,
      report_key: "journal_entry_items",
      locale: locale,
      template_file: Accounting::Reports::JournalEntryItemsTemplate.build(locale: locale).to_json
    },
    # Generated per organization when served (main currency decimals).
    *reporting_generators.map do |key, generator|
      { name: reporting_names.fetch(key), report_key: key, locale: locale, template_file: generator.build(locale: locale).to_json }
    end
  ]
end

report_templates.each do |attrs|
  template = ReportTemplate.find_or_initialize_by(report_key: attrs[:report_key], locale: attrs[:locale], organization_id: nil)
  template.write_attribute(:name, attrs[:name])
  template.template_file = attrs[:template_file]
  template.save!
end

puts "Seeded #{ReportTemplate.system.count} system report templates"
