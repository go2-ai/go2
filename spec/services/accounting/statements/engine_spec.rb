require "rails_helper"

RSpec.describe Accounting::Statements::Engine do
  def d(value) = BigDecimal(value.to_s)

  def line(key, kind: "mapped", side: "debit", parent: nil, formula: nil)
    described_class::Line.new(key: key, parent_key: parent, kind: kind, normal_side: side, formula: formula)
  end

  def rule(id, line_key, type, selector, **options)
    specificity = Accounting::StatementMappingRule::SPECIFICITY.fetch(type.to_s)
    specificity += 2 if options[:center_level] && (options[:center_ids].present? || options[:center_type_ids].present?)
    specificity += 1 if options[:currency_ids].present?
    described_class::Rule.new(id: id, line_key: line_key, selector_type: type.to_s, selector: selector,
                              center_ids: [], center_type_ids: [], currency_ids: [], grain: "account",
                              measure: "balance", position: id, specificity: specificity, **options)
  end

  def row(account_id, balance, ledger: 1, category: "CA", code: "1101", centers: [], currency: 1, period: nil,
          category_type: "balance_sheet")
    described_class::Row.new(key: [ account_id, *centers, currency ], account_id: account_id, ledger_id: ledger,
                             category_id: 1, category_identifier: category, category_type: category_type,
                             account_code: code, center_ids: centers, center_type_ids: [], currency_id: currency,
                             period: period, values: { "balance" => d(balance) })
  end

  def run(lines:, rules:, rows:, **options)
    described_class.new(lines: lines, rules: rules, rows: rows, **options).call
  end

  describe "rule resolution" do
    # The user's example: rule 1 maps the Expenses ledger, rule 2 the tax
    # account; tax rows match both and rule 2, the more specific, wins.
    let(:lines) { [ line("expenses", side: "credit"), line("tax", side: "credit") ] }
    let(:rules) do
      [ rule(1, "expenses", :ledger, { "ids" => [ 7 ] }), rule(2, "tax", :account, { "ids" => [ 70 ] }) ]
    end
    let(:rows) { [ row(70, 30, ledger: 7), row(71, 50, ledger: 7) ] }

    it "lets the more specific rule win and records the overridden one" do
      engine = run(lines: lines, rules: rules, rows: rows)

      expect(engine.values).to eq("expenses" => d(-50), "tax" => d(-30))
      tax = engine.resolutions.find { |r| r.row.account_id == 70 }
      expect(tax).to have_attributes(line_key: "tax", rule_id: 2, overridden_rule_ids: [ 1 ])
      expect(engine.resolutions.find { |r| r.row.account_id == 71 }.overridden_rule_ids).to eq([])
    end

    it "lets a higher priority beat specificity" do
      rules.first.priority = 5
      engine = run(lines: lines, rules: rules, rows: rows)

      expect(engine.values).to eq("expenses" => d(-80), "tax" => d(0))
      expect(engine.resolutions.find { |r| r.row.account_id == 70 }.overridden_rule_ids).to eq([ 2 ])
    end

    it "reports rules equal in priority and specificity as conflicts" do
      rules = [ rule(1, "expenses", :ledger, { "ids" => [ 7 ] }), rule(2, "tax", :ledger, { "ids" => [ 7 ] }) ]
      engine = run(lines: lines, rules: rules, rows: rows)

      expect(engine.conflicts).to eq([ { rule_ids: [ 1, 2 ], rows: 2 } ])
      expect(engine.values["expenses"]).to eq(d(-80)) # the first by position is used
    end

    it "treats center and currency filters as more specific" do
      rules = [
        rule(1, "expenses", :account, { "ids" => [ 70 ] }),
        rule(2, "tax", :account, { "ids" => [ 70 ] }, center_level: 1, center_ids: [ 9 ])
      ]
      engine = run(lines: lines, rules: rules, rows: [ row(70, 10, centers: [ 9 ]), row(70, 5, centers: [ 8 ]) ])

      expect(engine.values).to eq("expenses" => d(-5), "tax" => d(-10))
    end

    it "matches account ranges on the full code and accounts named in settings" do
      rules = [
        rule(1, "expenses", :account_range, { "from" => "71", "to" => "72" }),
        rule(2, "tax", :account, { "settings" => [ "retained_earnings_account_id" ] })
      ]
      rows = [ row(1, 1, code: "7101"), row(2, 2, code: "7299"), row(3, 4, code: "7301"), row(4, 8, code: "5101") ]
      engine = run(lines: lines, rules: rules, rows: rows, setting_accounts: { retained_earnings_account_id: 4 })

      expect(engine.values).to eq("expenses" => d(-3), "tax" => d(-8))
      expect(engine.unmapped.map { |r| r.row.account_id }).to eq([ 3 ])
    end
  end

  describe "sign split" do
    let(:lines) { [ line("receivables"), line("advances", side: "credit") ] }

    it "judges each customer separately with an account_center grain" do
      rules = [ rule(1, "receivables", :ledger, { "ids" => [ 1 ] }, opposite_line_key: "advances", grain: "account_center1") ]
      rows = [ row(10, 100, centers: [ 1 ]), row(10, -30, centers: [ 2 ]), row(10, 20, centers: [ 3 ]) ]
      engine = run(lines: lines, rules: rules, rows: rows)

      expect(engine.values).to eq("receivables" => d(120), "advances" => d(30))
      credit = engine.resolutions.find { |r| r.row.center_ids == [ 2 ] }
      expect(credit).to have_attributes(line_key: "advances", reclassified: true, group_total: d(-30))
    end

    it "nets the customers with an account grain" do
      rules = [ rule(1, "receivables", :ledger, { "ids" => [ 1 ] }, opposite_line_key: "advances") ]
      rows = [ row(10, 100, centers: [ 1 ]), row(10, -130, centers: [ 2 ]) ]
      engine = run(lines: lines, rules: rules, rows: rows)

      expect(engine.values).to eq("receivables" => d(0), "advances" => d(30))
      expect(engine.resolutions.map(&:group_total).uniq).to eq([ d(-30) ])
    end
  end

  describe "line values" do
    it "adds children to mapped parents and subtracts contra children of the other side" do
      lines = [
        line("non_current_assets"),
        line("ppe", parent: "non_current_assets"),
        line("depreciation", parent: "non_current_assets", side: "credit")
      ]
      rules = [ rule(1, "ppe", :account, { "ids" => [ 1 ] }), rule(2, "depreciation", :account, { "ids" => [ 2 ] }) ]
      engine = run(lines: lines, rules: rules, rows: [ row(1, 500), row(2, -120) ])

      expect(engine.values).to eq("non_current_assets" => d(380), "ppe" => d(500), "depreciation" => d(120))
    end

    it "evaluates formulas over line values" do
      lines = [
        line("revenue", side: "credit"), line("cost", side: "credit"),
        line("gross", kind: "formula", side: "credit", formula: "revenue + cost"),
        line("margin", kind: "formula", side: "credit", formula: "gross / revenue")
      ]
      rules = [ rule(1, "revenue", :category, { "identifiers" => [ "RE" ] }),
                rule(2, "cost", :category, { "identifiers" => [ "EX" ] }) ]
      engine = run(lines: lines, rules: rules,
                   rows: [ row(1, -200, category: "RE"), row(2, 150, category: "EX") ])

      expect(engine.values.slice("revenue", "cost", "gross", "margin"))
        .to eq("revenue" => d(200), "cost" => d(-150), "gross" => d(50), "margin" => d("0.25"))
    end

    it "reports formula cycles and errors" do
      lines = [
        line("a", kind: "formula", formula: "b + 1"), line("b", kind: "formula", formula: "a + 1"),
        line("c", kind: "formula", formula: "1 / d"), line("d")
      ]
      engine = run(lines: lines, rules: [], rows: [])

      expect(engine.errors.map { |e| e[:type] }).to include("cycle", "formula")
      expect(engine.values["c"]).to be_nil
    end

    it "keeps headings without amounts" do
      engine = run(lines: [ line("assets", kind: "heading") ], rules: [], rows: [])
      expect(engine.values).to eq("assets" => nil)
    end
  end

  it "maps income statement balances by period with profit_or_loss rules" do
    lines = [ line("retained", side: "credit"), line("profit", side: "credit") ]
    rules = [ rule(1, "retained", :profit_or_loss, { "period" => "prior" }),
              rule(2, "profit", :profit_or_loss, { "period" => "current" }) ]
    rows = [
      row(1, -100, category: "RE", category_type: "income_statement", period: "prior"),
      row(1, -40, category: "RE", category_type: "income_statement", period: "current"),
      row(2, 10, category: "EX", category_type: "income_statement", period: "current")
    ]
    expect(run(lines: lines, rules: rules, rows: rows).values).to eq("retained" => d(100), "profit" => d(30))
  end

  it "ignores zero rows without a rule but reports other unmapped rows" do
    engine = run(lines: [ line("x") ], rules: [], rows: [ row(1, 0), row(2, 5) ])
    expect(engine.unmapped.map { |r| r.row.account_id }).to eq([ 2 ])
  end
end
