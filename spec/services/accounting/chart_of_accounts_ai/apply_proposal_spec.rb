# frozen_string_literal: true

require "rails_helper"

RSpec.describe Accounting::ChartOfAccountsAi::ApplyProposal do
  let(:organization) { create(:organization, locale: "en", active_locales: [ "fa" ]) }
  let(:member)       { create(:member, organization: organization) }
  let(:chat) do
    create(:ai_chat, organization: organization, member: member,
           kind: "chart_of_accounts", status: "open",
           state: { "latest_proposal" => proposal_hash })
  end

  # Minimal valid proposal: one ledger under a system category, one
  # account under that ledger.
  let(:proposal_hash) do
    {
      "categories" => [],
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
    }
  end

  describe ".call on a well-formed proposal" do
    it "creates the ledger and account under the system category" do
      expect {
        described_class.call(chat: chat)
      }.to change { organization.account_categories.find_by(identifier: "CA").ledgers.count }.by(1)

      ca = organization.account_categories.find_by(identifier: "CA")
      ledger = ca.ledgers.find_by(code: "10")
      expect(ledger).to be_present
      expect(ledger.is_monetary).to be true
      expect(ledger.accounts.count).to eq(1)
      expect(ledger.accounts.first.name).to eq({ "en" => "Petty Cash", "fa" => "تنخواه" })
    end

    it "returns a successful result with the chat and chart" do
      result = described_class.call(chat: chat)

      expect(result.success?).to be true
      expect(result.chat.status).to eq("accepted")
      expect(result.chat.state["accepted_at"]).to be_present
      expect(result.chart).to be_an(Array)
      expect(result.chart.find { |c| c[:identifier] == "CA" }).to be_present
    end

    it "keeps latest_proposal in chat.state" do
      described_class.call(chat: chat)
      expect(chat.reload.state["latest_proposal"]).to eq(proposal_hash)
    end

    it "creates a custom category if the proposal declares one" do
      chat.update!(state: {
        "latest_proposal" => proposal_hash.merge(
          "categories" => [
            { "identifier" => nil, "code" => "0", "name" => { "en" => "Custom" }, "type" => "other" }
          ],
          "ledgers" => [
            {
              "category" => "0", "code" => "10",
              "name" => { "en" => "Custom Ledger" },
              "unexpected_balance" => "accept", "is_monetary" => false
            }
          ],
          "accounts" => [
            { "ledger" => "0.10", "code" => "01", "name" => { "en" => "Custom Account" } }
          ]
        )
      })

      expect {
        described_class.call(chat: chat)
      }.to change { organization.account_categories.where(identifier: nil).count }.by(1)

      custom = organization.account_categories.find_by(identifier: nil, code: "0")
      expect(custom).to be_present
      expect(custom.ledgers.count).to eq(1)
    end
  end

  describe ".call failure modes" do
    it "returns a failure result when chat.status is already accepted" do
      chat.update!(status: "accepted")
      result = described_class.call(chat: chat)

      expect(result.success?).to be false
      expect(result.errors.first[:message]).to match(/already accepted/)
    end

    it "returns a failure result when chat.state has no latest_proposal" do
      chat.update!(state: {})
      result = described_class.call(chat: chat)

      expect(result.success?).to be false
      expect(result.errors.first[:message]).to match(/no proposal/)
    end

    it "re-validates and fails when the proposal is invalid" do
      # RE cannot be monetary
      chat.update!(state: {
        "latest_proposal" => proposal_hash.merge(
          "ledgers" => [
            {
              "category" => "RE", "code" => "10",
              "name" => { "en" => "Revenue" },
              "unexpected_balance" => "accept", "is_monetary" => true
            }
          ],
          "accounts" => [
            { "ledger" => "RE.10", "code" => "01", "name" => { "en" => "Sales" } }
          ]
        )
      })

      result = described_class.call(chat: chat)

      expect(result.success?).to be false
      expect(result.errors.map { |e| e[:field] }).to include("is_monetary")
      expect(chat.reload.status).to eq("open")
    end

    it "does not persist anything when validation fails" do
      chat.update!(state: { "latest_proposal" => { "categories" => [], "ledgers" => [], "accounts" => [] } })

      expect {
        described_class.call(chat: chat)
      }.not_to change { organization.account_categories.find_by(identifier: "CA").ledgers.count }
    end
  end
end
