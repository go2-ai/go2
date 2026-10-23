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

  it "requires a supported locale" do
    expect(build(:report_template, locale: "fa")).to be_valid
    expect(build(:report_template, locale: "xx")).not_to be_valid
    expect(build(:report_template, locale: nil)).not_to be_valid
  end

  it "allows one system template per report key and locale" do
    create(:report_template, locale: "en")
    create(:report_template, locale: "fa")

    expect { create(:report_template, locale: "en") }.to raise_error(ActiveRecord::RecordNotUnique)
  end

  describe "seeded journal entry templates" do
    def template(locale)
      Rails.root.join("db/seeds/report_templates/journal_entry.#{locale}.json").read
    end

    it "are valid" do
      %w[en fa].each do |locale|
        expect(build(:report_template, locale: locale, template_file: template(locale))).to be_valid
      end
    end

    it "lay the Persian one out right to left with a Persian font" do
      fa = JSON.parse(template("fa"))
      en = JSON.parse(template("en"))
      header = ->(t) { t["body"][0]["header"]["components"].index_by { |c| c["id"] } }

      expect(fa["locale"]).to eq("fa-IR")
      expect(fa["styles"].values).to all(include("direction" => "rtl", "fontFamily" => "Yekan, Vazirmatn"))
      expect(header.call(fa)["th_row"]).to include("text" => "ردیف", "x" => 277 - 12)
      expect(header.call(en)["th_row"]).to include("text" => "Row", "x" => 0)
      expect(fa.to_json).not_to include("Roboto")
    end
  end

  it "seeds one system template per report key and locale, also when seeded again" do
    seeds = Rails.root.join("db/seeds/report_templates.rb")
    expect { 2.times { load seeds } }.to output.to_stdout

    expect(ReportTemplate.system.pluck(:report_key, :locale)).to match_array(
      ReportRegistry.keys.product(%w[en fa])
    )
    expect(ReportTemplate.system).to all(be_valid)
  end

  # Ariana Reports rejects templates whose data sources use these names
  # (RESERVED_SCOPE_NAMES in @ariana-reports/core 0.2.0).
  it "never names a system data source with a name Ariana reserves" do
    reserved = %w[params row rows rowNumber page report group groups parent]
    templates = %w[en fa].flat_map do |locale|
      [ Accounting::Reports::CurrencyRevaluationTemplate.build(locale: locale),
        Accounting::Reports::ExplorerTemplate.build(locale: locale),
        Accounting::Reports::JournalEntryItemsTemplate.build(locale: locale),
        JSON.parse(Rails.root.join("db/seeds/report_templates/journal_entry.#{locale}.json").read) ]
    end

    templates.each do |template|
      names = JSON.parse(template.to_json)["dataSources"].map { |source| source["name"] }
      expect(names & reserved).to be_empty, "#{template['name']} uses #{names & reserved}"
    end
  end

  describe "explorer print templates" do
    let(:organization) { create(:organization) }
    let(:generators) { [ Accounting::Reports::ExplorerTemplate, Accounting::Reports::JournalEntryItemsTemplate ] }

    def lines(template)
      template["body"].find { |item| item["id"] == "lines" }
    end

    it "fill the printable width, with the totals under their columns" do
      generators.each do |generator|
        template = JSON.parse(generator.build.to_json)
        width = template["page"]["orientation"] == "landscape" ? 277 : 190
        detail = lines(template)["detail"]["components"]
        expect(detail.sum { |c| c["width"] }).to be_within(0.01).of(width)
        footer = lines(template)["footer"]["components"]
        expect(footer.sum { |c| c["width"] }).to be_within(0.01).of(width)
        expect(template["dataSources"].map { |source| source["name"] }).to eq(%w[summary filters lines])
      end
    end

    it "are built in Persian, right to left" do
      generators.each do |generator|
        en = JSON.parse(generator.build.to_json)
        fa = JSON.parse(generator.build(locale: "fa").to_json)
        width = fa["page"]["orientation"] == "landscape" ? 277 : 190
        first_en = lines(en)["detail"]["components"].first
        first_fa = lines(fa)["detail"]["components"].first

        expect(fa["locale"]).to eq("fa-IR")
        expect(fa["styles"].values).to all(include("direction" => "rtl", "fontFamily" => "Yekan, Vazirmatn"))
        expect(first_en["x"]).to eq(0)
        expect(first_fa["x"] + first_fa["width"]).to be_within(0.01).of(width)
        expect(fa["name"]).not_to eq(en["name"])
      end
    end

    it "use the decimals of the organization's main currency" do
      organization.accounting_setting.main_currency.update!(decimal_digits: 0)
      system = create(:report_template, report_key: "explorer",
                                        template_file: Accounting::Reports::ExplorerTemplate.build.to_json)

      detail = lines(JSON.parse(system.template_file_for(organization)))["detail"]["components"].index_by { |c| c["id"] }
      expect(detail["td_sum_debit"]["format"]).to eq("type" => "number", "decimals" => 0)
    end
  end

  describe "#build_copy" do
    let(:organization) { create(:organization) }
    let(:source) { create(:report_template, locale: "fa") }

    it "keeps the source's locale" do
      expect(source.build_copy(organization: organization, created_by: nil).locale).to eq("fa")
    end

    it "uses another locale when given" do
      copy = source.build_copy(organization: organization, created_by: nil, locale: "en")

      expect(copy.locale).to eq("en")
      expect(copy.template_file).to eq(source.template_file)
    end
  end

  describe "currency revaluation template" do
    let(:organization) { create(:organization) }

    def template_for(levels, locale: "en")
      JSON.parse(Accounting::Reports::CurrencyRevaluationTemplate.build(center_levels: levels, locale: locale).to_json)
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

    it "is built in Persian, right to left, with the first column on the right" do
      en = template_for(2)
      fa = template_for(2, locale: "fa")
      en_cells = en["body"][0]["detail"]["components"].index_by { |c| c["id"] }
      fa_cells = fa["body"][0]["detail"]["components"].index_by { |c| c["id"] }

      expect(fa).to include("name" => "تسعیر اقلام پولی", "locale" => "fa-IR")
      expect(column_titles(fa)).to include("حساب", "مرکز 1", "مرکز 2", "کد")
      expect(column_titles(fa)).not_to include("Account")
      expect(fa["styles"].values).to all(include("direction" => "rtl", "fontFamily" => "Yekan, Vazirmatn"))
      expect(en_cells["td_account_code"]["x"]).to eq(0)
      expect(fa_cells["td_account_code"]["x"] + fa_cells["td_account_code"]["width"]).to be_within(0.01).of(277)
      expect(en_cells["td_difference"]["style"]["textAlign"]).to eq("right")
      expect(fa_cells["td_difference"]["style"]["textAlign"]).to eq("left")
      expect(detail_widths(fa)).to be_within(0.01).of(277)
    end

    it "is generated for the organization and the template's locale when served or copied" do
      organization.accounting_setting.update!(center_levels: 2)
      system = create(:report_template, organization: nil, report_key: "currency_revaluation",
                                        template_file: template_for(3).to_json)
      expect(column_titles(JSON.parse(system.template_file_for(organization)))).to include("Center 2")
      expect(column_titles(JSON.parse(system.template_file_for(organization)))).not_to include("Center 3")
      copy = system.build_copy(organization: organization, created_by: nil)
      expect(column_titles(JSON.parse(copy.template_file))).not_to include("Center 3")

      persian = create(:report_template, organization: nil, report_key: "currency_revaluation", locale: "fa",
                                         template_file: template_for(3, locale: "fa").to_json)
      expect(column_titles(JSON.parse(persian.template_file_for(organization)))).to include("مرکز 2")
      expect(column_titles(JSON.parse(persian.template_file_for(organization)))).not_to include("مرکز 3")
    end
  end
end
