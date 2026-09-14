# frozen_string_literal: true

require "rails_helper"

RSpec.describe Accounting::ChartOfAccountsProposalValidator do
  let(:organization) { create(:organization) }
  let(:settings)     { organization.accounting_setting }

  # Default accounting_setting values (from the migration):
  #   account_category_length: 1
  #   ledger_length:           2
  #   account_length:          2
  #   center_length:           6
  #   center_levels:           3

  def run(raw, org = organization)
    proposal = Accounting::ChartOfAccountsProposal.from(raw)
    described_class.call(proposal: proposal, organization: org)
  end

  def system_categories
    Accounting::ChartOfAccountsProposal::SYSTEM_CATEGORY_IDENTIFIERS.map do |id|
      { "identifier" => id }
    end
  end

  def well_formed_proposal(overrides = {})
    {
      "categories" => system_categories,
      "ledgers" => [
        { "category" => "CA", "code" => "10", "name" => { "en" => "Cash" },
          "unexpected_balance" => "accept", "is_monetary" => true }
      ],
      "accounts" => [
        { "ledger" => "CA.10", "code" => "01", "name" => { "en" => "Petty Cash" } }
      ]
    }.merge(overrides)
  end

  # ── Happy path ──────────────────────────────────────────────────────────

  describe "a well-formed proposal" do
    it "is valid" do
      result = run(well_formed_proposal)
      expect(result.valid?).to be true
      expect(result.errors).to eq([])
    end

    it "allows is_monetary: true on each balance-sheet category" do
      %w[CA LA CL LL OE].each do |identifier|
        raw = well_formed_proposal(
          "ledgers" => [
            { "category" => identifier, "code" => "10", "name" => { "en" => "X" },
              "unexpected_balance" => "accept", "is_monetary" => true }
          ],
          "accounts" => [
            { "ledger" => "#{identifier}.10", "code" => "01", "name" => { "en" => "A" } }
          ]
        )
        result = run(raw)
        expect(result.valid?).to be(true), "expected #{identifier} monetary ledger to be valid, got #{result.errors.inspect}"
      end
    end
  end

  # ── Structural errors bubble up ─────────────────────────────────────────

  describe "structural errors from the proposal object" do
    it "surfaces unknown-category errors from the proposal layer" do
      raw = well_formed_proposal(
        "ledgers" => [
          { "category" => "XX", "code" => "10", "name" => { "en" => "X" },
            "unexpected_balance" => "accept", "is_monetary" => false }
        ]
      )
      result = run(raw)
      expect(result.valid?).to be false
      expect(result.errors.map(&:message).join).to match(/unknown category "XX"/)
    end

    it "surfaces a missing-ledger-reference error" do
      raw = well_formed_proposal(
        "accounts" => [
          { "ledger" => "CA.99", "code" => "01", "name" => { "en" => "X" } }
        ]
      )
      result = run(raw)
      expect(result.valid?).to be false
      expect(result.errors.map(&:message).join).to match(/references ledger "CA.99"/)
    end
  end

  # ── Missing accounting_setting ──────────────────────────────────────────

  describe "when the organization has no accounting_setting" do
    let(:organization_without_settings) do
      org = create(:organization)
      org.accounting_setting.delete
      # Clear the per-instance association cache so the validator's
      # `organization.accounting_setting` re-reads from the DB and gets nil,
      # rather than returning the stale (now-destroyed) cached object.
      org.association(:accounting_setting).reset
      org
    end

    it "returns an error about the missing setting" do
      result = run(well_formed_proposal, organization_without_settings)
      expect(result.valid?).to be false
      expect(result.errors.map(&:path)).to include("accounting_setting")
    end
  end

  # ── Code length rules ───────────────────────────────────────────────────

  describe "category code length" do
    it "rejects a custom category whose code does not match account_category_length" do
      settings.update!(account_category_length: 2)

      raw = well_formed_proposal(
        "categories" => system_categories + [
          { "identifier" => nil, "code" => "0", "name" => { "en" => "Custom" }, "type" => "other" }
        ]
      )
      result = run(raw)
      expect(result.valid?).to be false
      expect(result.errors.map(&:field)).to include("code")
      expect(result.errors.map(&:message).join).to match(/category code must be exactly 2 characters/)
    end

    it "accepts a custom category whose code matches account_category_length" do
      settings.update!(account_category_length: 2)

      raw = well_formed_proposal(
        "categories" => system_categories + [
          { "identifier" => nil, "code" => "00", "name" => { "en" => "Custom" }, "type" => "other" }
        ]
      )
      result = run(raw)
      expect(result.valid?).to be true
    end

    it "does not enforce length on system categories" do
      # System categories have fixed codes ("1".."9") regardless of
      # account_category_length. A length mismatch there would be a data
      # bug, not an AI mistake — so the validator skips system cats.
      settings.update!(account_category_length: 3)

      result = run(well_formed_proposal)
      expect(result.valid?).to be true
    end
  end

  describe "ledger code length" do
    it "rejects a ledger whose code does not match ledger_length" do
      settings.update!(ledger_length: 3)

      raw = well_formed_proposal(
        "ledgers" => [
          { "category" => "CA", "code" => "10", "name" => { "en" => "Cash" },
            "unexpected_balance" => "accept", "is_monetary" => false }
        ],
        "accounts" => [
          { "ledger" => "CA.10", "code" => "01", "name" => { "en" => "A" } }
        ]
      )
      result = run(raw)
      expect(result.valid?).to be false
      expect(result.errors.map(&:message).join).to match(/ledger code must be exactly 3 characters/)
    end

    it "accepts a ledger whose code matches ledger_length" do
      settings.update!(ledger_length: 3)

      raw = well_formed_proposal(
        "ledgers" => [
          { "category" => "CA", "code" => "100", "name" => { "en" => "Cash" },
            "unexpected_balance" => "accept", "is_monetary" => false }
        ],
        "accounts" => [
          { "ledger" => "CA.100", "code" => "01", "name" => { "en" => "A" } }
        ]
      )
      result = run(raw)
      expect(result.valid?).to be true
    end
  end

  describe "account code length" do
    it "rejects an account whose code does not match account_length" do
      settings.update!(account_length: 3)

      raw = well_formed_proposal(
        "accounts" => [
          { "ledger" => "CA.10", "code" => "01", "name" => { "en" => "A" } }
        ]
      )
      result = run(raw)
      expect(result.valid?).to be false
      expect(result.errors.map(&:message).join).to match(/account code must be exactly 3 characters/)
    end

    it "accepts an account whose code matches account_length" do
      settings.update!(account_length: 3)

      raw = well_formed_proposal(
        "accounts" => [
          { "ledger" => "CA.10", "code" => "001", "name" => { "en" => "A" } }
        ]
      )
      result = run(raw)
      expect(result.valid?).to be true
    end
  end

  # ── is_monetary rules ───────────────────────────────────────────────────

  describe "is_monetary rules" do
    it "rejects is_monetary on RE (revenue) ledgers" do
      raw = well_formed_proposal(
        "ledgers" => [
          { "category" => "RE", "code" => "10", "name" => { "en" => "Service Revenue" },
            "unexpected_balance" => "accept", "is_monetary" => true }
        ],
        "accounts" => [
          { "ledger" => "RE.10", "code" => "01", "name" => { "en" => "Sales" } }
        ]
      )
      result = run(raw)
      expect(result.valid?).to be false
      expect(result.errors.map(&:field)).to include("is_monetary")
      expect(result.errors.map(&:message).join).to match(/is_monetary is only allowed on CA, LA, CL, LL, OE/)
    end

    it "rejects is_monetary on EX (expense) ledgers" do
      raw = well_formed_proposal(
        "ledgers" => [
          { "category" => "EX", "code" => "10", "name" => { "en" => "Rent" },
            "unexpected_balance" => "accept", "is_monetary" => true }
        ],
        "accounts" => [
          { "ledger" => "EX.10", "code" => "01", "name" => { "en" => "Office Rent" } }
        ]
      )
      result = run(raw)
      expect(result.valid?).to be false
      expect(result.errors.map(&:field)).to include("is_monetary")
    end

    it "rejects is_monetary on CO (control) ledgers" do
      raw = well_formed_proposal(
        "ledgers" => [
          { "category" => "CO", "code" => "10", "name" => { "en" => "Control" },
            "unexpected_balance" => "accept", "is_monetary" => true }
        ],
        "accounts" => [
          { "ledger" => "CO.10", "code" => "01", "name" => { "en" => "Control Acct" } }
        ]
      )
      result = run(raw)
      expect(result.valid?).to be false
      expect(result.errors.map(&:field)).to include("is_monetary")
    end

    it "rejects is_monetary on ME (memo) ledgers" do
      raw = well_formed_proposal(
        "ledgers" => [
          { "category" => "ME", "code" => "10", "name" => { "en" => "Memo" },
            "unexpected_balance" => "accept", "is_monetary" => true }
        ],
        "accounts" => [
          { "ledger" => "ME.10", "code" => "01", "name" => { "en" => "Memo Acct" } }
        ]
      )
      result = run(raw)
      expect(result.valid?).to be false
      expect(result.errors.map(&:field)).to include("is_monetary")
    end

    it "rejects is_monetary on a custom-category ledger" do
      raw = well_formed_proposal(
        "categories" => system_categories + [
          { "identifier" => nil, "code" => "0", "name" => { "en" => "Custom" }, "type" => "other" }
        ],
        "ledgers" => [
          { "category" => "0", "code" => "10", "name" => { "en" => "Custom Ledger" },
            "unexpected_balance" => "accept", "is_monetary" => true }
        ],
        "accounts" => [
          { "ledger" => "0.10", "code" => "01", "name" => { "en" => "Custom Acct" } }
        ]
      )
      result = run(raw)
      expect(result.valid?).to be false
      expect(result.errors.map(&:message).join).to match(/custom categories cannot be monetary/)
    end

    it "allows is_monetary: false on any category" do
      %w[CA LA CL LL OE RE EX CO ME].each do |identifier|
        raw = well_formed_proposal(
          "ledgers" => [
            { "category" => identifier, "code" => "10", "name" => { "en" => "X" },
              "unexpected_balance" => "accept", "is_monetary" => false }
          ],
          "accounts" => [
            { "ledger" => "#{identifier}.10", "code" => "01", "name" => { "en" => "A" } }
          ]
        )
        result = run(raw)
        expect(result.valid?).to be(true), "expected #{identifier} non-monetary ledger to be valid, got #{result.errors.inspect}"
      end
    end
  end

  # ── Completeness nudges ─────────────────────────────────────────────────

  describe "ledger completeness" do
    it "rejects a ledger with no accounts" do
      raw = well_formed_proposal(
        "accounts" => []
      )
      result = run(raw)
      expect(result.valid?).to be false
      expect(result.errors.map(&:field)).to include("accounts")
      expect(result.errors.map(&:message).join).to match(/ledger has no accounts/)
    end

    it "reports one error per empty ledger" do
      raw = well_formed_proposal(
        "ledgers" => [
          { "category" => "CA", "code" => "10", "name" => { "en" => "Cash" },
            "unexpected_balance" => "accept", "is_monetary" => false },
          { "category" => "CA", "code" => "11", "name" => { "en" => "AR" },
            "unexpected_balance" => "accept", "is_monetary" => false }
        ],
        "accounts" => [
          { "ledger" => "CA.10", "code" => "01", "name" => { "en" => "Petty Cash" } }
        ]
      )
      result = run(raw)
      expect(result.valid?).to be false
      accounts_errors = result.errors.select { |e| e.field == "accounts" }
      expect(accounts_errors.size).to eq(1)
      expect(accounts_errors.first.path).to eq("111") # CA(1) + ledger(11)
    end
  end

  describe "at-least-one-ledger" do
    it "rejects a proposal with no ledgers" do
      raw = well_formed_proposal("ledgers" => [], "accounts" => [])
      result = run(raw)
      expect(result.valid?).to be false
      expect(result.errors.map(&:path)).to include("ledgers")
      expect(result.errors.map(&:message).join).to match(/contains no ledgers/)
    end
  end

  # ── Error shape ─────────────────────────────────────────────────────────

  describe "error shape" do
    it "returns errors as structs with path, field, and message" do
      raw = well_formed_proposal(
        "ledgers" => [
          { "category" => "RE", "code" => "10", "name" => { "en" => "Rev" },
            "unexpected_balance" => "accept", "is_monetary" => true }
        ],
        "accounts" => [
          { "ledger" => "RE.10", "code" => "01", "name" => { "en" => "Sales" } }
        ]
      )
      result = run(raw)
      expect(result.valid?).to be false

      err = result.errors.find { |e| e.field == "is_monetary" }
      expect(err).to be_a(Accounting::ChartOfAccountsProposalValidator::Error)
      expect(err.path).to eq("610")
      expect(err.field).to eq("is_monetary")
      expect(err.message).to be_a(String)
    end

    it "returns an empty errors array when valid" do
      result = run(well_formed_proposal)
      expect(result.errors).to eq([])
      expect(result.valid?).to be true
    end
  end

  # ── Interaction with the settings object ────────────────────────────────

  describe "when code length settings are blank" do
    it "skips the corresponding length check" do
      settings.update!(ledger_length: nil)

      raw = well_formed_proposal(
        "ledgers" => [
          { "category" => "CA", "code" => "12345", "name" => { "en" => "Cash" },
            "unexpected_balance" => "accept", "is_monetary" => false }
        ],
        "accounts" => [
          { "ledger" => "CA.12345", "code" => "01", "name" => { "en" => "A" } }
        ]
      )
      result = run(raw)
      # No ledger-length error because the setting is blank.
      expect(result.errors.map(&:message).join).not_to match(/ledger code must be exactly/)
    end
  end
end
