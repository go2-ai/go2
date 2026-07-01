FactoryBot.define do
  factory :group do
    organization { Organization.first || create(:organization) }

    name { nil }

    after(:build) do |group, evaluator|
      name_value = evaluator.name
      if name_value.is_a?(String)
        default_locale = group.organization&.locale || I18n.default_locale
        group.write_attribute(:name, { default_locale => name_value })
      elsif name_value.is_a?(Hash)
        group.write_attribute(:name, name_value)
      else
        group.name_en = "Test Group"
      end
    end
  end
end
