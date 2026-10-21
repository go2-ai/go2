# WebMock stubs for the ECB reference rate feeds (spec/fixtures/files/ecb).
module EcbStubs
  def stub_ecb(feed = :daily, status: 200)
    url = Accounting::ExchangeRates::Providers::Ecb::FEEDS.fetch(feed)
    file = Rails.root.join("spec/fixtures/files/ecb", File.basename(URI(url).path))
    stub_request(:get, url).to_return(status: status, body: status == 200 ? File.read(file) : "")
  end
end

RSpec.configure do |config|
  config.include EcbStubs
end
