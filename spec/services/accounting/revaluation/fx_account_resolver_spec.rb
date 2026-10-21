require "rails_helper"

RSpec.describe Accounting::Revaluation::FxAccountResolver do
  let(:organization) { create(:organization) }
  let(:default_gain) { create_account_in(organization, "RE", ledger_code: "90", account_code: "01") }
  let(:default_loss) { create_account_in(organization, "EX", ledger_code: "90", account_code: "01") }
  let(:operating_gain) { create_account_in(organization, "RE", ledger_code: "90", account_code: "02") }
  let(:operating_loss) { create_account_in(organization, "EX", ledger_code: "90", account_code: "02") }
  let(:non_operating_gain) { create_account_in(organization, "RE", ledger_code: "90", account_code: "03") }

  let(:receivable) { create_account_in(organization, "CA", ledger_code: "20", account_code: "01", monetary: true) }
  let(:loan) { create_account_in(organization, "LL", ledger_code: "10", account_code: "01", monetary: true) }
  let(:bank) { create_account_in(organization, "CA", ledger_code: "10", account_code: "01", monetary: true) }

  before do
    organization.accounting_setting.update!(default_fx_gain_account: default_gain, default_fx_loss_account: default_loss)
    receivable.ledger.update!(fx_gain_account: operating_gain, fx_loss_account: operating_loss)
    loan.update!(fx_gain_account: non_operating_gain)
  end

  subject(:resolver) { described_class.new(organization: organization) }

  it "falls back to the settings defaults" do
    result = resolver.resolve(bank)
    expect(result.gain_account_id).to eq(default_gain.id)
    expect(result.loss_account_id).to eq(default_loss.id)
  end

  it "uses the ledger override" do
    expect(resolver.resolve(receivable.id).to_h).to eq(gain_account_id: operating_gain.id, loss_account_id: operating_loss.id)
  end

  it "prefers the account override, per side" do
    result = resolver.preload([ loan.id ]).resolve(loan.id)
    expect(result.gain_account_id).to eq(non_operating_gain.id)
    expect(result.loss_account_id).to eq(default_loss.id)
  end

  it "picks the account for the sign of a difference" do
    result = resolver.resolve(bank)
    expect(result.for_difference(BigDecimal("10"))).to eq(default_gain.id)
    expect(result.for_difference(BigDecimal("-10"))).to eq(default_loss.id)
  end

  it "reports incomplete configuration" do
    organization.accounting_setting.update!(default_fx_loss_account: nil)
    expect(described_class.new(organization: organization).resolve(bank)).not_to be_complete
  end
end
