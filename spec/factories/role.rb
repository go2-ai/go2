FactoryBot.define do
  factory :role do
    organization { Organization.first || create(:organization) }
    department { organization.departments.first || create(:department, organization: organization) }
    name { nil }

    trait :inactive do
      active { false }
    end

    after(:build) do |role, evaluator|
      name_value = evaluator.name
      if name_value.is_a?(String)
        default_locale = role.organization&.locale || I18n.default_locale
        role.write_attribute(:name, { default_locale => name_value })
      elsif name_value.is_a?(Hash)
        role.write_attribute(:name, name_value)
      else
        role.name = { "en" => "Test role" }
      end
    end
  end
end
