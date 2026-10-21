require "rails_helper"

RSpec.describe Accounting::ExchangeRates::Resolver do
  let(:organization) { create(:organization) }
  let(:usd) { organization.accounting_setting.main_currency }
  let(:eur) { create(:accounting_currency, organization: organization, abr: "EUR") }
  let(:gbp) { create(:accounting_currency, organization: organization, abr: "GBP") }
  let(:chf) { create(:accounting_currency, organization: organization, abr: "CHF") }

  def rate!(currency, date, rate, source: "manual", quote: nil)
    create(:accounting_exchange_rate, organization: organization, currency: currency,
           date: date, rate: rate, source: source, quote_currency: quote)
  end

  def resolver(date)
    described_class.new(organization: organization, date: date)
  end

  it "returns 1 for the main currency" do
    expect(resolver(Date.new(2024, 1, 1)).resolve(usd).rate).to eq(1)
  end

  it "uses the latest rate on or before the date" do
    rate!(eur, Date.new(2024, 1, 1), "1.10")
    rate!(eur, Date.new(2024, 1, 5), "1.12")
    rate!(eur, Date.new(2024, 1, 9), "1.15")

    result = resolver(Date.new(2024, 1, 7)).resolve(eur)
    expect(result.rate).to eq(BigDecimal("1.12"))
    expect(result.rate_date).to eq(Date.new(2024, 1, 5))
  end

  it "prefers a manual rate over a provider rate on the same date" do
    rate!(eur, Date.new(2024, 1, 5), "1.12", source: "ecb")
    rate!(eur, Date.new(2024, 1, 5), "1.20")

    result = resolver(Date.new(2024, 1, 5)).resolve(eur)
    expect(result.rate).to eq(BigDecimal("1.20"))
    expect(result.sources).to eq(%w[manual])
  end

  it "prefers a newer provider rate over an older manual one" do
    rate!(eur, Date.new(2024, 1, 4), "1.20")
    rate!(eur, Date.new(2024, 1, 5), "1.12", source: "ecb")

    expect(resolver(Date.new(2024, 1, 6)).resolve(eur).rate).to eq(BigDecimal("1.12"))
  end

  it "computes cross rates through the quote currency" do
    # 1 GBP = 1.17 EUR (provider), 1 EUR = 1.10 USD (manual).
    rate!(eur, Date.new(2024, 1, 2), "1.10")
    rate!(gbp, Date.new(2024, 1, 3), "1.17", source: "ecb", quote: eur)

    result = resolver(Date.new(2024, 1, 3)).resolve(gbp)
    expect(result.rate).to eq(BigDecimal("1.287"))
    expect(result.rate_date).to eq(Date.new(2024, 1, 2))
    expect(result.path.map(&:currency_id)).to eq([ gbp.id, eur.id ])
    expect(result.sources).to contain_exactly("ecb", "manual")
  end

  it "reports currencies without a rate" do
    r = resolver(Date.new(2024, 1, 1))
    expect(r.resolve(eur)).to be_nil
    expect(r.error_for(eur)).to eq(:missing)
  end

  it "reports a missing rate further down the chain" do
    rate!(gbp, Date.new(2024, 1, 3), "1.17", quote: eur)
    r = resolver(Date.new(2024, 1, 3))
    expect(r.resolve(gbp)).to be_nil
    expect(r.error_for(gbp)).to eq(:missing)
  end

  it "detects cycles" do
    rate!(eur, Date.new(2024, 1, 3), "0.9", quote: chf)
    rate!(chf, Date.new(2024, 1, 3), "1.1", quote: eur)
    r = resolver(Date.new(2024, 1, 3))
    expect(r.resolve(eur)).to be_nil
    expect(r.error_for(eur)).to eq(:cycle)
  end

  it "ignores rates of other organizations" do
    other = create(:organization)
    other_eur = create(:accounting_currency, organization: other, abr: "EUR")
    create(:accounting_exchange_rate, organization: other, currency: other_eur, date: Date.new(2024, 1, 1), rate: 2)

    expect(resolver(Date.new(2024, 1, 1)).resolve(eur)).to be_nil
  end
end
