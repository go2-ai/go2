require "rails_helper"

RSpec.describe Accounting::ExchangeRates::FetchJob, type: :job do
  include ActiveJob::TestHelper

  let(:organization) { create(:organization) }
  let(:eur) { create(:accounting_currency, organization: organization, abr: "EUR") }

  before do
    travel_to Time.utc(2026, 10, 19, 15)
    create(:accounting_exchange_rate_source, organization: organization, currency: eur, provider: "ecb")
  end

  it "fans out one job per organization with provider sources" do
    other = create(:organization)
    create(:accounting_exchange_rate_source, organization: other,
           currency: create(:accounting_currency, organization: other, abr: "GBP"), provider: "manual")

    expect { described_class.perform_now }
      .to have_enqueued_job(described_class).with(organization.id).exactly(:once)
  end

  it "fetches rates for an organization" do
    stub_ecb(:daily)
    expect { described_class.perform_now(organization.id) }
      .to change { Accounting::ExchangeRate.where(currency: eur, source: "ecb").count }.by(1)
  end

  it "doesn't raise when the provider is unavailable" do
    stub_ecb(:daily, status: 500)
    expect { described_class.perform_now(organization.id) }.not_to raise_error
  end
end
