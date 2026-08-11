# spec/factories/accounting/center.rb
FactoryBot.define do
  factory :accounting_center, class: "Accounting::Center" do
    transient do
      organization { nil }
    end

    center_type do
      if organization
        create(:accounting_center_type, organization: organization,
               first_code: "000001", last_code: "000050")
      else
        create(:accounting_center_type, first_code: "000001", last_code: "000050")
      end
    end
    name { nil }
    code { center_type.first_code }
    metadata { {} }

    after(:build) do |center, evaluator|
      name_value = evaluator.name
      if name_value.is_a?(String)
        default_locale = center.organization&.locale || I18n.default_locale
        center.write_attribute(:name, { default_locale => name_value })
      elsif name_value.is_a?(Hash)
        center.write_attribute(:name, name_value)
      else
        center.name_en = "Test Center"
      end

      # Ensure metadata is set even on build (before DB default kicks in)
      center.metadata ||= {}
    end
  end
end
