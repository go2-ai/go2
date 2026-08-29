# app/systems/accounting/serializers/journal_entry_blueprint.rb
module Accounting
  class JournalEntryBlueprint < Blueprinter::Base
    identifier :id

    fields :date,
           :effective_date,
           :fiscal_year_id,
           :no,
           :ref,
           :daily_no,
           :state,
           :entry_type,
           :organization_id,
           :creator_id,
           :created_at

    field :debit do |je|
      je.debit.to_f
    end

    field :credit do |je|
      je.credit.to_f
    end

    field :creator_name do |journal_entry|
      journal_entry.creator&.name
    end

    field :translations_hash, name: :t

    view :show do
      association :items, blueprint: Accounting::JournalEntryItemBlueprint
    end
  end
end
