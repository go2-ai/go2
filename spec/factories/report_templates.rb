FactoryBot.define do
  factory :report_template do
    name { "MyString" }
    report_key { "MyString" }
    template_file { "MyText" }
    parent_template_id { 1 }
    organization { nil }
    created_by { 1 }
    is_default { false }
  end
end
