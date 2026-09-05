# app/systems/accounting/serializers/journal_entry_item_blueprint.rb
module Accounting
  class JournalEntryItemBlueprint < Blueprinter::Base
    identifier :id

    fields :row,
           :account_id,
           :center1_id,
           :center2_id,
           :center3_id,
           :center4_id,
           :center5_id,
           :center6_id,
           :currency_id,
           :description

    field :debit do |item|
      item.debit.to_f
    end

    field :credit do |item|
      item.credit.to_f
    end

    field :rate do |item|
      item.rate&.to_f
    end

    field :currency_amount do |item|
      item.currency_amount&.to_f
    end

    field :account_code do |item|
      item.account&.code
    end

    field :account_name do |item|
      item.account&.name
    end

    field :abr do |item|
      item.currency.abr
    end

    field :translations_hash, name: :t

    view :with_journal_entry do
      association :journal_entry, blueprint: Accounting::JournalEntryBlueprint, view: :explorer
    end

    view :print_journal_entry do
      field :account_code do |item| item.account&.full_code end
      field :currency do |item| item.currency.abr end
      field :center_1_code do |item| item.center1&.code end
      field :center_1_name do |item| item.center1&.name end
      field :center_2_code do |item| item.center2&.code end
      field :center_2_name do |item| item.center2&.name end
      field :center_3_code do |item| item.center3&.code end
      field :center_3_name do |item| item.center3&.name end
      field :center_4_code do |item| item.center4&.code end
      field :center_4_name do |item| item.center4&.name end
      field :center_5_code do |item| item.center5&.code end
      field :center_5_name do |item| item.center5&.name end
      field :center_6_code do |item| item.center6&.code end
      field :center_6_name do |item| item.center6&.name end
    end
  end
end
