# spec/factories/accounting/ledger.rb
FactoryBot.define do
  factory :accounting_ledger, class: "Accounting::Ledger" do
    account_category { nil }
    code { "1#{SecureRandom.random_number(10..99)}" }
    name { nil }
    contra_for_id { nil }
    unexpected_balance { :accept }
    is_monetary { false }

    after(:build) do |ledger, evaluator|
      # Ensure account_category exists
      if ledger.account_category.nil?
        organization = Organization.first || create(:organization)
        ledger.account_category = organization.account_categories.find_by(identifier: "CA") ||
                                   create(:accounting_account_category, organization: organization, identifier: "CA", type: :balance_sheet, code: "1")
      end

      # Handle name
      name_value = evaluator.name
      if name_value.is_a?(String)
        default_locale = ledger.organization&.locale || I18n.default_locale
        ledger.write_attribute(:name, { default_locale => name_value })
      elsif name_value.is_a?(Hash)
        ledger.write_attribute(:name, name_value)
      else
        ledger.name_en = "Test Ledger"
      end
    end
  end
end