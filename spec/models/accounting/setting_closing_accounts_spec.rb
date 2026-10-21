require "rails_helper"

RSpec.describe Accounting::Setting, "closing and FX accounts", type: :model do
  let(:organization) { create(:organization) }
  let(:setting) { organization.accounting_setting }

  let(:retained_earnings) { create_account_in(organization, "OE", ledger_code: "30", name: "Retained earnings") }
  let(:current_year_profit) { create_account_in(organization, "OE", ledger_code: "40", name: "Current year profit") }
  let(:income_summary) { create_account_in(organization, "OE", ledger_code: "50", name: "Income summary") }
  let(:fx_gain) { create_account_in(organization, "RE", ledger_code: "90", name: "FX gain") }
  let(:fx_loss) { create_account_in(organization, "EX", ledger_code: "90", name: "FX loss") }
  let(:bank) { create_account_in(organization, "CA", ledger_code: "10", monetary: true, name: "Bank") }

  it "defaults to closing directly to retained earnings" do
    expect(setting).to be_closing_direct
  end

  it "accepts valid closing and FX accounts" do
    setting.assign_attributes(
      closing_method: :income_summary,
      retained_earnings_account: retained_earnings,
      income_summary_account: income_summary,
      current_year_profit_account: current_year_profit,
      default_fx_gain_account: fx_gain,
      default_fx_loss_account: fx_loss
    )
    expect(setting).to be_valid
  end

  it "requires owners' equity accounts for retained earnings and current year profit" do
    setting.assign_attributes(retained_earnings_account: bank, current_year_profit_account: fx_gain)
    expect(setting).not_to be_valid
    expect(setting.errors[:retained_earnings_account_id]).to include(/owners' equity/)
    expect(setting.errors[:current_year_profit_account_id]).to include(/owners' equity/)
  end

  it "rejects income statement or monetary income summary accounts" do
    setting.income_summary_account = fx_gain
    expect(setting).not_to be_valid
    expect(setting.errors[:income_summary_account_id]).to include(/revenue or expense/)

    setting.income_summary_account = bank
    expect(setting).not_to be_valid
    expect(setting.errors[:income_summary_account_id]).to include(/monetary/)
  end

  it "requires income statement accounts for FX gain/loss" do
    setting.default_fx_gain_account = bank
    expect(setting).not_to be_valid
    expect(setting.errors[:default_fx_gain_account_id]).to include(/revenue or expense/)
  end

  it "rejects accounts of other organizations" do
    other = create(:organization)
    setting.retained_earnings_account = create_account_in(other, "OE", ledger_code: "30")
    expect(setting).not_to be_valid
    expect(setting.errors[:retained_earnings_account_id]).to include(/this organization/)
  end

  it "requires distinct closing accounts" do
    setting.assign_attributes(retained_earnings_account: retained_earnings, current_year_profit_account: retained_earnings)
    expect(setting).not_to be_valid
    expect(setting.errors[:current_year_profit_account_id]).to include(/different/)
  end

  describe "#closing_configuration_errors" do
    it "lists the accounts the closing method needs" do
      setting.closing_method = :income_summary
      expect(setting.closing_configuration_errors.size).to eq(2)

      setting.assign_attributes(income_summary_account: income_summary, retained_earnings_account: retained_earnings)
      expect(setting.closing_configuration_errors).to be_empty
    end

    it "needs only the current year profit account for that method" do
      setting.closing_method = :current_year_profit
      expect(setting.closing_configuration_errors).to eq(
        [ "Current year profit account is required to close to current year profit" ]
      )
    end
  end

  describe "ledger and account overrides" do
    it "require income statement accounts" do
      bank.ledger.fx_gain_account = bank
      expect(bank.ledger).not_to be_valid

      bank.fx_loss_account = fx_loss
      expect(bank).to be_valid
    end
  end
end
