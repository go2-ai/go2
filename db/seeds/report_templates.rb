# System report templates (Ariana Reports JSON). They are owned by the code:
# running the seeds again updates them to the versions in db/seeds/report_templates.
report_templates = [
  {
    name: { "en" => "Journal Entry", "fa" => "سند حسابداری" },
    report_key: "journal_entry",
    template_file: File.read(Rails.root.join("db/seeds/report_templates/journal_entry.json"))
  }
]

report_templates.each do |attrs|
  template = ReportTemplate.find_or_initialize_by(report_key: attrs[:report_key], organization_id: nil)
  template.write_attribute(:name, attrs[:name])
  template.template_file = attrs[:template_file]
  template.is_default = true
  template.save!
end

puts "Seeded #{ReportTemplate.system.count} system report templates"
