FactoryBot.define do
  factory :report_template do
    report_key { "journal_entry" }
    template_file { { schemaVersion: 1, name: "Journal Entry", unit: "mm", page: { size: "A4" }, dataSources: [], body: [] }.to_json }
    organization { nil }
    is_default { false }

    after(:build) do |template|
      template.write_attribute(:name, { "en" => "Journal Entry", "fa" => "سند حسابداری" }) if template.read_attribute(:name).blank?
    end
  end
end
