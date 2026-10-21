FactoryBot.define do
  factory :accounting_exchange_rate, class: "Accounting::ExchangeRate" do
    organization { currency.organization }
    currency { association :accounting_currency }
    date { Date.current }
    rate { 1.5 }
    source { "manual" }
  end

  factory :accounting_exchange_rate_source, class: "Accounting::ExchangeRateSource" do
    organization { currency.organization }
    currency { association :accounting_currency }
    provider { "manual" }
  end
end
