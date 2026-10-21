require "rails_helper"

RSpec.describe Accounting::ExchangeRate, type: :model do
  let(:organization) { create(:organization) }
  let(:usd) { organization.accounting_setting.main_currency }
  let(:eur) { create(:accounting_currency, organization: organization, abr: "EUR") }
  let(:gbp) { create(:accounting_currency, organization: organization, abr: "GBP") }

  it { should be_versioned }

  it "is valid with a positive rate" do
    expect(build(:accounting_exchange_rate, currency: eur, rate: 1.08)).to be_valid
  end

  it "requires a positive rate" do
    rate = build(:accounting_exchange_rate, currency: eur, rate: 0)
    expect(rate).not_to be_valid
    expect(rate.errors[:rate]).to be_present
  end

  it "allows one rate per currency, date and source" do
    create(:accounting_exchange_rate, currency: eur, date: Date.new(2024, 1, 2))
    duplicate = build(:accounting_exchange_rate, currency: eur, date: Date.new(2024, 1, 2))
    expect(duplicate).not_to be_valid
    expect(duplicate.errors[:date]).to include(/already has a rate/)

    expect(build(:accounting_exchange_rate, currency: eur, date: Date.new(2024, 1, 2), source: "ecb")).to be_valid
  end

  it "rejects rates for the main currency" do
    rate = build(:accounting_exchange_rate, organization: organization, currency: usd)
    expect(rate).not_to be_valid
    expect(rate.errors[:currency_id]).to include(/main currency/)
  end

  it "stores a quote in the main currency as blank" do
    rate = create(:accounting_exchange_rate, currency: eur, quote_currency: usd)
    expect(rate.quote_currency_id).to be_nil
    expect(rate.effective_quote_currency_id).to eq(usd.id)
  end

  it "rejects quoting a currency in itself" do
    rate = build(:accounting_exchange_rate, currency: eur, quote_currency: eur)
    expect(rate).not_to be_valid
  end

  it "rejects currencies of other organizations" do
    other_currency = create(:accounting_currency, organization: create(:organization), abr: "CHF")
    rate = build(:accounting_exchange_rate, organization: organization, currency: eur, quote_currency: other_currency)
    expect(rate).not_to be_valid
    expect(rate.errors[:quote_currency_id]).to include(/this organization/)
  end

  it "is removed with its currency" do
    create(:accounting_exchange_rate, currency: eur)
    create(:accounting_exchange_rate, currency: gbp, quote_currency: eur)
    expect { eur.destroy! }.to change(described_class, :count).by(-2)
  end
end
