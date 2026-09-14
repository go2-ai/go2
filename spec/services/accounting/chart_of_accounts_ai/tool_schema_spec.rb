# frozen_string_literal: true

require "rails_helper"

RSpec.describe Accounting::ChartOfAccountsAi::ToolSchema do
  describe ".name" do
    it "returns the propose_chart_of_accounts identifier" do
      expect(described_class.name).to eq("propose_chart_of_accounts")
    end
  end

  describe ".definition" do
    subject(:definition) { described_class.definition }

    it "is an OpenAI-style function tool" do
      expect(definition[:type]).to eq("function")
      expect(definition[:function][:name]).to eq("propose_chart_of_accounts")
      expect(definition[:function][:description]).to be_a(String)
    end

    it "declares categories, ledgers, accounts as required" do
      params = definition[:function][:parameters]
      expect(params[:required]).to contain_exactly("categories", "ledgers", "accounts")
    end

    it "requires at least one ledger" do
      ledgers = definition[:function][:parameters][:properties][:ledgers]
      expect(ledgers[:minItems]).to eq(1)
    end

    it "requires at least one account" do
      accounts = definition[:function][:parameters][:properties][:accounts]
      expect(accounts[:minItems]).to eq(1)
    end

    it "restricts unexpected_balance to accept/warn/disallow" do
      ledger_props = definition[:function][:parameters][:properties][:ledgers][:items][:properties]
      expect(ledger_props[:unexpected_balance][:enum]).to eq(%w[accept warn disallow])
    end

    it "requires the exact set of ledger fields" do
      ledger_props = definition[:function][:parameters][:properties][:ledgers][:items]
      expect(ledger_props[:required]).to contain_exactly(
        "category", "code", "name", "unexpected_balance", "is_monetary"
      )
      expect(ledger_props[:additionalProperties]).to be false
    end

    it "requires the exact set of account fields" do
      account_props = definition[:function][:parameters][:properties][:accounts][:items]
      expect(account_props[:required]).to contain_exactly(
        "ledger", "code", "name", "accepts_other_currencies"
      )
      expect(account_props[:additionalProperties]).to be false
    end
  end

  describe "round-trip with ChartOfAccountsProposal" do
    # A minimal, well-formed proposal matching the schema's shape must
    # be structurally parseable by ChartOfAccountsProposal — this keeps
    # the schema and the value object from drifting apart silently.
    it "produces a schema whose shape the proposal value object accepts" do
      proposal_hash = {
        "categories" => [],
        "ledgers" => [
          {
            "category" => "CA",
            "code" => "10",
            "name" => { "en" => "Cash" },
            "unexpected_balance" => "accept",
            "is_monetary" => true
          }
        ],
        "accounts" => [
          {
            "ledger" => "CA.10",
            "code" => "01",
            "name" => { "en" => "Petty Cash" },
            "accepts_other_currencies" => false
          }
        ]
      }

      proposal = Accounting::ChartOfAccountsProposal.from(proposal_hash)
      expect(proposal.valid_structure?).to be true
    end
  end
end
