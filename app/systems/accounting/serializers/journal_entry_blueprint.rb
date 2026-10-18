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

    # Data for printed reports (Ariana Reports templates read it as `root`).
    view :print do
      fields :no, :ref, :description
      field :date do |je| je.date&.strftime("%Y-%m-%d") end
      field :creator do |je| je.creator&.name end
      field :organization_name do |je| je.organization.name end
      # Main currency of the organization; debit and credit are in this
      # currency. Used for amounts in words: amountInWords(total, root.currency).
      field :currency do |je|
        currency = je.organization.accounting_setting&.main_currency
        next nil unless currency

        {
          abr: currency.abr,
          name: currency.name,
          names: currency.read_attribute(:name) || {},
          decimal_digits: currency.decimal_digits
        }
      end
      association :items, blueprint: Accounting::JournalEntryItemBlueprint, view: :print_journal_entry do |journal_entry|
        journal_entry.items.sort_by(&:row)
      end
    end
  end
end
