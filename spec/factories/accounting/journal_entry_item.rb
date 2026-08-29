FactoryBot.define do
  factory :accounting_journal_entry_item, class: "Accounting::JournalEntryItem" do
    journal_entry { create(:accounting_journal_entry) }
    row { 1 }
    account { nil }
    debit { 0 }
    credit { 0 }
    currency { journal_entry.organization.accounting_setting.main_currency }
    rate { 1.0 }
    currency_amount { 0 }

    after(:build) do |item, evaluator|
      if evaluator.description.present?
        item.write_attribute(:description, evaluator.description)
      end
    end
  end
end
