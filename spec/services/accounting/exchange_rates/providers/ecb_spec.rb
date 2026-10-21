require "rails_helper"

RSpec.describe Accounting::ExchangeRates::Providers::Ecb do
  subject(:provider) { described_class.new }

  let(:today) { Date.new(2026, 10, 19) }

  it "parses the latest day of the daily feed" do
    stub_ecb(:daily)
    rates = provider.rates(today: today)

    expect(rates.keys).to eq([ Date.new(2026, 10, 16) ])
    day = rates[Date.new(2026, 10, 16)]
    expect(day["USD"]).to eq(BigDecimal("1.1253"))
    expect(day["GBP"]).to eq(BigDecimal("0.84385"))
    expect(day["EUR"]).to eq(1)
  end

  it "uses the 90 day feed for recent ranges and filters by date" do
    stub_ecb(:last_90_days)
    rates = provider.rates(from: Date.new(2026, 10, 15), to: Date.new(2026, 10, 16), today: today)
    expect(rates.keys).to contain_exactly(Date.new(2026, 10, 15), Date.new(2026, 10, 16))
  end

  it "uses the full history feed for older ranges" do
    stub_ecb(:history)
    rates = provider.rates(from: Date.new(2025, 12, 30), to: Date.new(2025, 12, 31), today: today)
    expect(rates.keys).to contain_exactly(Date.new(2025, 12, 30), Date.new(2025, 12, 31))
    expect(rates[Date.new(2025, 12, 31)]["USD"]).to eq(BigDecimal("1.0389"))
  end

  it "raises a provider error on HTTP errors" do
    stub_ecb(:daily, status: 503)
    expect { provider.rates(today: today) }.to raise_error(described_class::Error, /503/)
  end

  it "raises a provider error on network errors" do
    stub_request(:get, described_class::FEEDS[:daily]).to_timeout
    expect { provider.rates(today: today) }.to raise_error(described_class::Error, /request failed/)
  end

  it "raises a provider error on malformed responses" do
    stub_request(:get, described_class::FEEDS[:daily]).to_return(status: 200, body: "<html>maintenance")
    expect { provider.rates(today: today) }.to raise_error(described_class::Error, /Unexpected/)
  end
end
