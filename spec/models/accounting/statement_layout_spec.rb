require "rails_helper"

RSpec.describe "Statement layouts" do
  let(:organization) { create(:organization) }

  def preset(key)
    Reporting::Report.system.find_by!(key: key)
  end

  before { Accounting::Statements::Presets::Loader.call }

  describe Accounting::Statements::Presets::Loader do
    it "loads the IFRS presets as system reports" do
      bs = preset("ifrs.balance_sheet")
      expect(bs).to be_system
      expect(bs.report_type).to eq("accounting.statement")
      expect(bs.statement_layout.lines.find_by!(key: "total_assets")).to be_formula
      expect(preset("ifrs.income_statement").statement_layout.lines.pluck(:key))
        .to include("operating_profit", "profit_before_financing_and_income_taxes")
    end

    it "is idempotent" do
      counts = -> { [ Reporting::Report.count, Accounting::StatementLine.count, Accounting::StatementMappingRule.count ] }
      before = counts.call
      Accounting::Statements::Presets::Loader.call
      expect(counts.call).to eq(before)
    end
  end

  describe Reporting::Reports::Copy do
    it "copies the layout and points the copy's rules at its own lines" do
      source = preset("ifrs.balance_sheet")
      copy = described_class.call(source: source, organization: organization)

      layout = copy.statement_layout
      expect(copy.parent_report).to eq(source)
      expect(copy.organization).to eq(organization)
      expect(copy).to be_primary
      expect(layout.lines.count).to eq(source.statement_layout.lines.count)
      expect(layout.rules.map { |rule| rule.line.statement_layout_id }.uniq).to eq([ layout.id ])
      expect(layout.lines.find_by!(key: "trade_and_other_receivables").parent.key).to eq("current_assets")
      copied = layout.lines.find_by!(key: "assets")
      expect(copied.label).to eq("Assets")
      expect(copied.read_attribute(:label)).to include("en" => "Assets", "fa" => be_a(String))
    end

    it "names a second copy as a copy and keeps the first one primary" do
      source = preset("ifrs.balance_sheet")
      described_class.call(source: source, organization: organization)
      second = described_class.call(source: source, organization: organization)

      expect(second.name).to eq("Statement of financial position (IFRS) (Copy)")
      expect(second).not_to be_primary
    end

    it "refuses another organization's report" do
      other = described_class.call(source: preset("ifrs.balance_sheet"), organization: create(:organization))
      expect { described_class.call(source: other, organization: organization) }.to raise_error(ArgumentError)
    end
  end

  describe Accounting::StatementLine do
    let(:layout) { preset("ifrs.income_statement").statement_layout }

    it "rejects an invalid formula" do
      line = layout.lines.new(key: "broken", kind: :formula, formula: "revenue +", label: { "en" => "x" })
      expect(line).not_to be_valid
      expect(line.errors[:formula].first).to include("not a valid formula")
    end

    it "requires unique, well-formed keys" do
      expect(layout.lines.new(key: "revenue", label: { "en" => "x" })).not_to be_valid
      expect(layout.lines.new(key: "Bad Key", label: { "en" => "x" })).not_to be_valid
    end

    it "lists formula dependencies" do
      expect(layout.lines.find_by!(key: "gross_profit").formula_dependencies).to eq(%w[revenue cost_of_sales])
    end
  end

  describe Accounting::StatementMappingRule do
    let(:layout) { preset("ifrs.balance_sheet").statement_layout }
    let(:line) { layout.lines.find_by!(key: "trade_and_other_receivables") }

    def rule(**attributes)
      layout.rules.new({ line: line, selector_type: :ledger, selector: { "ids" => [ 1 ] } }.merge(attributes))
    end

    it "validates selectors" do
      expect(rule).to be_valid
      expect(rule(selector: {})).not_to be_valid
      expect(rule(selector_type: :account_range, selector: { "from" => "12", "to" => "11" })).not_to be_valid
      expect(rule(selector_type: :account, selector: { "settings" => [ "unknown" ] })).not_to be_valid
    end

    it "requires a center level for center filters" do
      expect(rule(center_ids: [ 1 ])).not_to be_valid
      expect(rule(center_ids: [ 1 ], center_level: 1)).to be_valid
    end

    it "doesn't map to headings or lines of other layouts" do
      expect(rule(line: layout.lines.find_by!(key: "assets"))).not_to be_valid
      other_line = preset("ifrs.income_statement").statement_layout.lines.first
      expect(rule(opposite_line: other_line)).not_to be_valid
    end

    it "ranks specificity: account > range > ledger > category, filters add to it" do
      ranks = [
        rule(selector_type: :account, selector: { "ids" => [ 1 ] }),
        rule(selector_type: :account_range, selector: { "from" => "1", "to" => "2" }),
        rule,
        rule(selector_type: :category, selector: { "identifiers" => [ "CA" ] })
      ].map(&:specificity)
      expect(ranks).to eq(ranks.sort.reverse)
      expect(rule(center_level: 1, center_ids: [ 1 ]).specificity).to be > rule.specificity
    end
  end
end
