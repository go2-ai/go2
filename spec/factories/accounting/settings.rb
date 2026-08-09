FactoryBot.define do
  factory :accounting_setting, class: "Accounting::Setting" do
    organization { Organization.first || create(:organization) }
  end
end