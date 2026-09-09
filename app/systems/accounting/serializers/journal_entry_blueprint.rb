# app/systems/accounting/serializers/journal_entry_blueprint.rb
module Accounting
  class JournalEntryBlueprint < Blueprinter::Base
    identifier :id

    view :index do
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
    end

    view :show do
      include_view :index
      association :items, blueprint: Accounting::JournalEntryItemBlueprint do |journal_entry|
        journal_entry.items.sort_by(&:row)
      end
    end

    view :explorer do
      fields :date, :no, :ref
    end

    view :print do
      fields :no, :ref, :date, :description
      field :creator do |je| je.creator.name end
      association :items, blueprint: Accounting::JournalEntryItemBlueprint, view: :print_journal_entry do |journal_entry|
        journal_entry.items.sort_by(&:row)
      end
    end
  end
end
