FactoryBot.define do
  factory :department do
    organization { Organization.first || create(:organization) }

    name { nil }

    after(:build) do |dept, evaluator|
      name_value = evaluator.name
      if name_value.is_a?(String)
        default_locale = dept.organization&.locale || I18n.default_locale
        dept.write_attribute(:name, { default_locale => name_value })
      elsif name_value.is_a?(Hash)
        dept.write_attribute(:name, name_value)
      else
        dept.name = { "en" => "Test dept" }
      end
    end

    abbreviation { (0..3).map { ('A'..'Z').to_a.sample }.join }
  end
end
