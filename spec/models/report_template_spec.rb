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

  describe "currency revaluation template" do
    let(:organization) { create(:organization) }

    def template_for(levels)
      JSON.parse(Accounting::Reports::CurrencyRevaluationTemplate.build(center_levels: levels).to_json)
    end

    def column_titles(template)
      template["body"][0]["header"]["components"].map { |c| c["text"] }
    end

    def detail_widths(template)
      template["body"][0]["detail"]["components"].sum { |c| c["width"] }
    end

    it "is a valid A4 landscape template" do
      content = Accounting::Reports::CurrencyRevaluationTemplate.build(center_levels: 3).to_json
      expect(build(:report_template, report_key: "currency_revaluation", template_file: content)).to be_valid
      expect(JSON.parse(content)["page"]).to include("size" => "A4", "orientation" => "landscape")
    end

    it "has a code and a name column per center level, filling the page width" do
      [ 1, 3, 6 ].each do |levels|
        template = template_for(levels)
        titles = column_titles(template)
        expect(titles).to include(*(1..levels).map { |l| "Center #{l}" })
        expect(titles).not_to include("Center #{levels + 1}")
        expect(titles.count("Code")).to eq(levels + 1) # account + centers
        expect(detail_widths(template)).to be_within(0.01).of(277)
      end
    end

    it "formats base amounts with the main currency's decimals and foreign balances as given" do
      template = JSON.parse(Accounting::Reports::CurrencyRevaluationTemplate.build(center_levels: 1, main_digits: 0).to_json)
      cells = template["body"][0]["detail"]["components"].index_by { |c| c["id"] }
      expect(cells["td_difference"]["format"]).to eq("type" => "number", "decimals" => 0)
      expect(cells["td_currency_balance"]["text"]).to eq("{{ row.currency_balance_text }}")
      expect(cells["td_currency_balance"]).not_to have_key("format")
    end

    it "is generated for the organization when served or copied" do
      organization.accounting_setting.update!(center_levels: 2)
      system = create(:report_template, organization: nil, report_key: "currency_revaluation",
                                        template_file: template_for(3).to_json)
      expect(column_titles(JSON.parse(system.template_file_for(organization)))).to include("Center 2")
      expect(column_titles(JSON.parse(system.template_file_for(organization)))).not_to include("Center 3")
      copy = system.build_copy(organization: organization, created_by: nil)
      expect(column_titles(JSON.parse(copy.template_file))).not_to include("Center 3")
    end
  end
end
