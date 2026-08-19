FactoryBot.define do
  factory :fiscal_year do
    organization { Organization.first || create(:organization) }
    start_date { Date.current.beginning_of_year }
    finish_date { Date.current.end_of_year }

    after(:build) do |fiscal_year, evaluator|
      name_value = evaluator.name
      if name_value.is_a?(String)
        default_locale = fiscal_year.organization&.locale || I18n.default_locale
        fiscal_year.write_attribute(:name, { default_locale => name_value })
      elsif name_value.is_a?(Hash)
        fiscal_year.write_attribute(:name, name_value)
      else
        fiscal_year.name_en = "Fiscal Year #{fiscal_year.start_date&.year || Date.current.year}"
      end
    end
  end
end
