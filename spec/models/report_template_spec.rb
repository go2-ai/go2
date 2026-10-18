require 'rails_helper'

RSpec.describe ReportTemplate, type: :model do
  it "accepts a JSON object as template_file" do
    expect(build(:report_template)).to be_valid
  end

  it "rejects template_file that is not a JSON object" do
    [ "not json", "[1, 2]", "\"text\"" ].each do |content|
      template = build(:report_template, template_file: content)
      expect(template).not_to be_valid, "expected #{content.inspect} to be rejected"
      expect(template.errors[:template_file]).to be_present
    end
  end

  it "rejects templates over the size limit" do
    template = build(:report_template, template_file: { data: "x" * ReportTemplate::MAX_TEMPLATE_SIZE }.to_json)

    expect(template).not_to be_valid
  end

  it "accepts the seeded journal entry template" do
    content = Rails.root.join("db/seeds/report_templates/journal_entry.json").read

    expect(build(:report_template, template_file: content)).to be_valid
  end
end
