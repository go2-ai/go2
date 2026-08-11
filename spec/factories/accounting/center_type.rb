# spec/factories/accounting/center_type.rb
FactoryBot.define do
  factory :accounting_center_type, class: "Accounting::CenterType" do
    organization { Organization.first || create(:organization) }
    name { nil }
    first_code { "001" }
    last_code { "010" }
    auto_increment { true }
    metadata { [] }

    after(:build) do |center_type, evaluator|
      name_value = evaluator.name
      if name_value.is_a?(String)
        default_locale = center_type.organization&.locale || I18n.default_locale
        center_type.write_attribute(:name, { default_locale => name_value })
      elsif name_value.is_a?(Hash)
        center_type.write_attribute(:name, name_value)
      else
        center_type.name_en = "Test Center Type"
      end
    end
  end
end
