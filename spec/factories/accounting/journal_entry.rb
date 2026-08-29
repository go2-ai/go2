FactoryBot.define do
  factory :accounting_journal_entry, class: "Accounting::JournalEntry" do
    organization { Organization.first || create(:organization) }
    fiscal_year { create(:fiscal_year, organization: organization) }
    date { Date.current }
    effective_date { date }
    state { :draft }
    entry_type { :normal }

    after(:build) do |journal_entry, evaluator|
      desc = evaluator.description || { "en" => "Test Journal Entry" }
      journal_entry.write_attribute(:description, desc)
    end

    trait :booked do
      state { :booked }
    end

    trait :approved do
      state { :approved }
    end
  end
end
