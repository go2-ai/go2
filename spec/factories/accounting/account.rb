# spec/factories/accounting/ledger.rb
FactoryBot.define do
  factory :accounting_account, class: "Accounting::Account" do
    name { nil }
    contra_for_id { nil }
    accepts_other_currencies { false }

    after(:build) do |ledger, evaluator|
      name_value = evaluator.name
      if name_value.is_a?(String)
        default_locale = ledger.organization&.locale || I18n.default_locale
        ledger.write_attribute(:name, { default_locale => name_value })
      elsif name_value.is_a?(Hash)
        ledger.write_attribute(:name, name_value)
      else
        ledger.name_en = "Test Account"
      end
    end
  end
end
