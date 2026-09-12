report_templates = [
  {
    name: { "en" => "Journal Entry", "fa" => "سند حسابداری" },
    report_key: "journal_entry",
    template_file: File.read("db/seeds/report_templates/journal_entry_en.mrt")
  }
]

report_templates.each do |attrs|
  ReportTemplate.find_or_create_by!(
    report_key: attrs[:report_key],
    organization_id: nil
  ) do |template|
    template.name = attrs[:name]
    template.template_file = attrs[:template_file]
    template.is_default = true
  end
end

puts "Seeded #{ReportTemplate.system.count} system report templates"
