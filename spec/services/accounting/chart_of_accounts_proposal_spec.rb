# frozen_string_literal: true

require "rails_helper"

RSpec.describe Accounting::ChartOfAccountsProposal do
  def proposal_from(raw)
    described_class.from(raw)
  end

  # ── Fixture helpers ─────────────────────────────────────────────────────

  def base_categories
    # Nine system categories, no names — the minimal well-formed input.
    described_class::SYSTEM_CATEGORY_IDENTIFIERS.map do |identifier|
      { "identifier" => identifier }
    end
  end

  def sample_proposal(overrides = {})
    {
      "categories" => base_categories,
      "ledgers" => [
        {
          "category" => "CA",
          "code" => "10",
          "name" => { "en" => "Cash", "fa" => "نقد" },
          "unexpected_balance" => "accept",
          "is_monetary" => true
        }
      ],
      "accounts" => [
        {
          "ledger" => "CA.10",
          "code" => "01",
          "name" => { "en" => "Petty Cash", "fa" => "تنخواه" },
          "accepts_other_currencies" => false
        }
      ]
    }.merge(overrides)
  end

  # ── Construction & basic shape ──────────────────────────────────────────

  describe ".from" do
    it "always includes the nine system categories" do
      proposal = proposal_from(sample_proposal)
      identifiers = proposal.categories.select { |c| c[:system] }.map { |c| c[:identifier] }
      expect(identifiers).to contain_exactly(*described_class::SYSTEM_CATEGORY_IDENTIFIERS)
    end

    it "assigns the well-known numeric code to each system category" do
      proposal = proposal_from(sample_proposal)
      codes = proposal.categories.select { |c| c[:system] }.to_h { |c| [ c[:identifier], c[:code] ] }
      expect(codes).to eq(described_class::SYSTEM_CATEGORY_CODES)
    end

    it "resolves ledger full_code by concatenating category and ledger code" do
      proposal = proposal_from(sample_proposal)
      expect(proposal.ledgers.first[:full_code]).to eq("110")
    end

    it "resolves account full_code by concatenating ledger full_code and account code" do
      proposal = proposal_from(sample_proposal)
      expect(proposal.accounts.first[:full_code]).to eq("11001")
    end

    it "marks ledger origin as 'system' when its category is system" do
      proposal = proposal_from(sample_proposal)
      expect(proposal.ledgers.first[:origin]).to eq("system")
    end

    it "marks ledger origin as 'custom' when its category is custom" do
      raw = sample_proposal(
        "categories" => base_categories + [
          { "identifier" => nil, "code" => "0", "name" => { "en" => "Custom" }, "type" => "other" }
        ],
        "ledgers" => [
          {
            "category" => "0",
            "code" => "10",
            "name" => { "en" => "Memo Ledger" },
            "unexpected_balance" => "accept",
            "is_monetary" => false
          }
        ],
        "accounts" => [
          { "ledger" => "0.10", "code" => "01", "name" => { "en" => "Memo Account" } }
        ]
      )
      proposal = proposal_from(raw)
      expect(proposal.ledgers.first[:origin]).to eq("custom")
    end

    it "accepts symbol-keyed input correctly" do
      raw = {
        categories: base_categories.map { |c| c.transform_keys(&:to_sym) },
        ledgers: [
          { category: "CA", code: "10", name: { en: "Cash" }, unexpected_balance: "accept", is_monetary: true }
        ],
        accounts: [
          { ledger: "CA.10", code: "01", name: { en: "Petty" } }
        ]
      }
      proposal = proposal_from(raw)
      expect(proposal.valid_structure?).to be true
      expect(proposal.ledgers.first[:full_code]).to eq("110")
    end

    it "handles a proposal with missing top-level keys gracefully" do
      proposal = proposal_from({})
      expect(proposal.categories.select { |c| c[:system] }.size).to eq(9)
      expect(proposal.ledgers).to eq([])
      expect(proposal.accounts).to eq([])
      expect(proposal.valid_structure?).to be true # empty ledgers/accounts is structurally fine; validator will complain
    end
  end

  # ── Name normalization ──────────────────────────────────────────────────

  describe "name normalization" do
    it "keeps only non-blank locale values and symbolizes keys" do
      raw = sample_proposal(
        "ledgers" => [
          {
            "category" => "CA", "code" => "10",
            "name" => { "en" => "Cash", "fa" => "  ", "ar" => "" },
            "unexpected_balance" => "accept", "is_monetary" => false
          }
        ]
      )
      ledger = proposal_from(raw).ledgers.first
      expect(ledger[:name]).to eq({ en: "Cash" })
    end
  end

  # ── Structural error handling ───────────────────────────────────────────

  describe "structural errors" do
    it "flags a ledger that references an unknown category" do
      raw = sample_proposal(
        "ledgers" => [
          { "category" => "XX", "code" => "10", "name" => { "en" => "X" },
            "unexpected_balance" => "accept", "is_monetary" => false }
        ]
      )
      proposal = proposal_from(raw)
      expect(proposal.valid_structure?).to be false
      expect(proposal.structural_errors.map(&:message).join).to match(/unknown category "XX"/)
    end

    it "flags a ledger with a blank code" do
      raw = sample_proposal(
        "ledgers" => [
          { "category" => "CA", "code" => "", "name" => { "en" => "X" },
            "unexpected_balance" => "accept", "is_monetary" => false }
        ]
      )
      proposal = proposal_from(raw)
      expect(proposal.valid_structure?).to be false
      expect(proposal.structural_errors.map(&:field)).to include("code")
    end

    it "flags a ledger with a blank name" do
      raw = sample_proposal(
        "ledgers" => [
          { "category" => "CA", "code" => "10", "name" => {},
            "unexpected_balance" => "accept", "is_monetary" => false }
        ]
      )
      proposal = proposal_from(raw)
      expect(proposal.valid_structure?).to be false
      expect(proposal.structural_errors.map(&:field)).to include("name")
    end

    it "flags an invalid unexpected_balance value" do
      raw = sample_proposal(
        "ledgers" => [
          { "category" => "CA", "code" => "10", "name" => { "en" => "X" },
            "unexpected_balance" => "banana", "is_monetary" => false }
        ]
      )
      proposal = proposal_from(raw)
      expect(proposal.valid_structure?).to be false
      expect(proposal.structural_errors.map(&:field)).to include("unexpected_balance")
    end

    it "flags duplicate ledger codes within the same category" do
      raw = sample_proposal(
        "ledgers" => [
          { "category" => "CA", "code" => "10", "name" => { "en" => "A" },
            "unexpected_balance" => "accept", "is_monetary" => false },
          { "category" => "CA", "code" => "10", "name" => { "en" => "B" },
            "unexpected_balance" => "accept", "is_monetary" => false }
        ],
        "accounts" => []
      )
      proposal = proposal_from(raw)
      expect(proposal.valid_structure?).to be false
      expect(proposal.structural_errors.map(&:message).join).to match(/duplicate ledger/)
    end

    it "flags an account referencing a nonexistent ledger" do
      raw = sample_proposal(
        "accounts" => [
          { "ledger" => "CA.99", "code" => "01", "name" => { "en" => "X" } }
        ]
      )
      proposal = proposal_from(raw)
      expect(proposal.valid_structure?).to be false
      expect(proposal.structural_errors.map(&:message).join).to match(/references ledger "CA.99"/)
    end

    it "flags an account whose ledger field lacks a dot" do
      raw = sample_proposal(
        "accounts" => [
          { "ledger" => "CA10", "code" => "01", "name" => { "en" => "X" } }
        ]
      )
      proposal = proposal_from(raw)
      expect(proposal.valid_structure?).to be false
      expect(proposal.structural_errors.map(&:message).join).to match(/must be a "<category_ref>.<ledger_code>"/)
    end

    it "flags duplicate account codes within the same ledger" do
      raw = sample_proposal(
        "accounts" => [
          { "ledger" => "CA.10", "code" => "01", "name" => { "en" => "A" } },
          { "ledger" => "CA.10", "code" => "01", "name" => { "en" => "B" } }
        ]
      )
      proposal = proposal_from(raw)
      expect(proposal.valid_structure?).to be false
      expect(proposal.structural_errors.map(&:message).join).to match(/duplicate account/)
    end
  end

  # ── Custom category rules (v1) ──────────────────────────────────────────

  describe "custom categories" do
    it "accepts a custom category with type 'other' and a code" do
      raw = sample_proposal(
        "categories" => base_categories + [
          { "identifier" => nil, "code" => "0", "name" => { "en" => "Custom" }, "type" => "other" }
        ]
      )
      proposal = proposal_from(raw)
      custom = proposal.categories.reject { |c| c[:system] }
      expect(custom.size).to eq(1)
      expect(custom.first[:type]).to eq("other")
      expect(proposal.valid_structure?).to be true
    end

    it "rejects a custom category with a type other than 'other'" do
      raw = sample_proposal(
        "categories" => base_categories + [
          { "identifier" => nil, "code" => "0", "name" => { "en" => "Custom" }, "type" => "balance_sheet" }
        ]
      )
      proposal = proposal_from(raw)
      expect(proposal.valid_structure?).to be false
      expect(proposal.structural_errors.map(&:message).join).to match(/must have type: "other"/)
    end

    it "rejects a custom category missing a code" do
      raw = sample_proposal(
        "categories" => base_categories + [
          { "identifier" => nil, "name" => { "en" => "Custom" }, "type" => "other" }
        ]
      )
      proposal = proposal_from(raw)
      expect(proposal.valid_structure?).to be false
      expect(proposal.structural_errors.map(&:field)).to include("code")
    end

    it "rejects a custom category whose code collides with a system category" do
      raw = sample_proposal(
        "categories" => base_categories + [
          { "identifier" => nil, "code" => "1", "name" => { "en" => "Custom" }, "type" => "other" }
        ]
      )
      proposal = proposal_from(raw)
      expect(proposal.valid_structure?).to be false
      expect(proposal.structural_errors.map(&:message).join).to match(/duplicate category code/)
    end

    it "rejects a system category declared with an unknown identifier" do
      raw = sample_proposal(
        "categories" => base_categories + [
          { "identifier" => "ZZ", "code" => "0" }
        ]
      )
      proposal = proposal_from(raw)
      expect(proposal.valid_structure?).to be false
      expect(proposal.structural_errors.map(&:message).join).to match(/unknown system category "ZZ"/)
    end

    it "merges a name onto a system category when explicitly declared" do
      raw = sample_proposal(
        "categories" => [
          { "identifier" => "CA", "name" => { "en" => "Current Assets" } }
        ] + (described_class::SYSTEM_CATEGORY_IDENTIFIERS - [ "CA" ]).map { |id| { "identifier" => id } }
      )
      proposal = proposal_from(raw)
      ca = proposal.categories.find { |c| c[:identifier] == "CA" }
      expect(ca[:name]).to eq({ en: "Current Assets" })
    end
  end
end
