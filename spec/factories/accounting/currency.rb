FactoryBot.define do
  factory :accounting_currency, class: "Accounting::Currency" do
    organization { Organization.first || create(:organization) }
    abr { "USD#{rand(1000)}" }
    decimal_digits { 2 }
    name { nil }

    after(:build) do |currency, evaluator|
      name_value = evaluator.name
      if name_value.is_a?(String)
        default_locale = currency.organization&.locale || I18n.default_locale
        currency.write_attribute(:name, { default_locale => name_value })
      elsif name_value.is_a?(Hash)
        currency.write_attribute(:name, name_value)
      else
        currency.name_en = "US Dollar"
      end
    end
  end
end