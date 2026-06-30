FactoryBot.define do
  factory :member do
    organization { Organization.first || create(:organization) }

    name { nil }

    after(:build) do |member, evaluator|
      name_value = evaluator.name
      if name_value.is_a?(String)
        default_locale = member.organization&.locale || I18n.default_locale
        member.write_attribute(:name, { default_locale => name_value })
      elsif name_value.is_a?(Hash)
        member.write_attribute(:name, name_value)
      else
        member.name_en = "Test Member"
      end
    end

    email { "email#{ rand(1..1000) }@test.com" }

    trait :invited do
      invited_at { DateTime.now }
    end

    trait :joined do
      invited_at { DateTime.now - 1.day }
      joined_at { DateTime.now }
    end
  end
end
