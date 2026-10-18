FactoryBot.define do
  factory :organization do
    name { { en: "Organization #{SecureRandom.uuid}" } }

    after(:build) do |organization, evaluator|
      name_value = evaluator.name
      if name_value.is_a?(String)
        default_locale = organization.locale || I18n.default_locale
        organization.write_attribute(:name, { default_locale => name_value })
      elsif name_value.is_a?(Hash)
        organization.write_attribute(:name, name_value)
      else
        organization.name = { "en" => "Test Organization" }
      end
    end

    # Organizations auto-create a default fiscal year on create. Most specs
    # build their own fiscal years, so drop it unless explicitly kept.
    transient do
      keep_default_fiscal_year { false }
    end

    after(:create) do |organization, evaluator|
      organization.fiscal_years.destroy_all unless evaluator.keep_default_fiscal_year
    end

    trait :with_default_fiscal_year do
      keep_default_fiscal_year { true }
    end
  end
end
