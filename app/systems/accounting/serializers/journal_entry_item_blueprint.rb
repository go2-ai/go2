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
           :currency_id

    field :debit do |item|
      item.debit.to_f
    end

    field :credit do |item|
      item.credit.to_f
    end

    field :rate do |item|
      item.rate.to_f
    end

    field :currency_amount do |item|
      item.currency_amount.to_f
    end

    field :account_code do |item|
      item.account&.code
    end

    field :account_name do |item|
      item.account&.name
    end

    field :translations_hash, name: :t
  end
end
