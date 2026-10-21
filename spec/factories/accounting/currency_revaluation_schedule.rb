FactoryBot.define do
  factory :accounting_currency_revaluation_schedule, class: "Accounting::CurrencyRevaluationSchedule" do
    organization { Organization.first || create(:organization) }
    name { "Daily revaluation" }
    rrule { "FREQ=DAILY" }
    dtstart { Time.current.beginning_of_day + 23.hours }
    default_kind { :temporary }
    on_unapproved { :partial }
  end
end
