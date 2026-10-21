require "rails_helper"

RSpec.describe Accounting::ExchangeRates::Fetcher do
  let(:organization) { create(:organization) }
  let(:usd) { organization.accounting_setting.main_currency }
  let(:eur) { create(:accounting_currency, organization: organization, abr: "EUR") }
  let(:gbp) { create(:accounting_currency, organization: organization, abr: "GBP") }
  let(:irr) { create(:accounting_currency, organization: organization, abr: "IRR") }

  def fetch(**range)
    described_class.new(organization: organization).call(**range)
  end

  def ecb_source!(currency, quote: nil)
    create(:accounting_exchange_rate_source, organization: organization, currency: currency,
           provider: "ecb", quote_currency: quote)
  end

  before { travel_to Time.utc(2026, 10, 19, 12) }

  it "does nothing without provider sources" do
    expect(fetch.created).to eq(0)
    expect(a_request(:get, /ecb/)).not_to have_been_made
  end

  it "stores EUR quoted in the main currency (USD)" do
    stub_ecb(:daily)
    ecb_source!(eur)

    result = fetch
    expect(result.created).to eq(1)
    rate = Accounting::ExchangeRate.find_by!(currency: eur, source: "ecb")
    expect(rate.date).to eq(Date.new(2026, 10, 16))
    expect(rate.rate).to eq(BigDecimal("1.1253"))
    expect(rate.quote_currency_id).to be_nil
    expect(rate.meta["pair"]).to eq("EUR/USD")
  end

  it "converts other currencies through EUR (cross rate)" do
    stub_ecb(:daily)
    ecb_source!(gbp)

    fetch
    rate = Accounting::ExchangeRate.find_by!(currency: gbp, source: "ecb")
    expect(rate.rate).to eq((BigDecimal("1.1253") / BigDecimal("0.84385")).round(15))
  end

  it "stores rates in the source's quote currency when the main currency isn't published" do
    usd # the original main currency, before switching to IRR
    organization.accounting_setting.update!(main_currency: irr)
    stub_ecb(:daily)
    ecb_source!(eur, quote: usd)

    fetch
    rate = Accounting::ExchangeRate.find_by!(currency: eur, source: "ecb")
    expect(rate.quote_currency_id).to eq(usd.id)
    expect(rate.rate).to eq(BigDecimal("1.1253"))
  end

  it "skips currencies whose quote currency isn't published" do
    organization.accounting_setting.update!(main_currency: irr)
    stub_ecb(:daily)
    ecb_source!(eur)

    result = fetch
    expect(result.created).to eq(0)
    expect(result.skipped).to contain_exactly(hash_including(currency: "EUR", reason: "not_published", codes: [ "IRR" ]))
  end

  it "ignores inactive and manual sources" do
    stub_ecb(:daily)
    ecb_source!(eur).update!(active: false)
    create(:accounting_exchange_rate_source, organization: organization, currency: gbp, provider: "manual")

    expect(fetch.created).to eq(0)
  end

  it "is idempotent and updates changed rates" do
    stub_ecb(:daily)
    ecb_source!(eur)

    fetch
    expect(fetch.unchanged).to eq(1)

    Accounting::ExchangeRate.find_by!(currency: eur, source: "ecb").update_column(:rate, 2)
    expect(fetch.updated).to eq(1)
    expect(Accounting::ExchangeRate.where(currency: eur, source: "ecb").count).to eq(1)
  end

  it "backfills a range and leaves manual rates alone" do
    stub_ecb(:last_90_days)
    ecb_source!(eur)
    create(:accounting_exchange_rate, organization: organization, currency: eur, date: Date.new(2026, 10, 15), rate: 9)

    result = fetch(from: Date.new(2026, 10, 14), to: Date.new(2026, 10, 16))
    expect(result.created).to eq(3)
    expect(result.dates).to eq([ Date.new(2026, 10, 14), Date.new(2026, 10, 15), Date.new(2026, 10, 16) ])
    expect(Accounting::ExchangeRate.find_by!(currency: eur, source: "manual").rate).to eq(9)
  end

  it "limits the range" do
    expect { fetch(from: Date.new(2024, 1, 1), to: Date.new(2026, 1, 1)) }
      .to raise_error(described_class::RangeError)
    expect { fetch(from: Date.new(2026, 1, 2), to: Date.new(2026, 1, 1)) }
      .to raise_error(described_class::RangeError)
  end
end
