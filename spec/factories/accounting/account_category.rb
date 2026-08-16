# spec/factories/accounting/account_category.rb
FactoryBot.define do
  factory :accounting_account_category, class: "Accounting::AccountCategory" do
    organization { Organization.first || create(:organization) }
    code { "1#{rand(100..999)}" }
    name { nil }
    type { :other }
    identifier { nil }

    after(:build) do |account_category, evaluator|
      name_value = evaluator.name
      if name_value.is_a?(String)
        default_locale = account_category.organization&.locale || I18n.default_locale
        account_category.write_attribute(:name, { default_locale => name_value })
      elsif name_value.is_a?(Hash)
        account_category.write_attribute(:name, name_value)
      else
        account_category.name_en = "Test Account Category"
      end
    end
  end
end