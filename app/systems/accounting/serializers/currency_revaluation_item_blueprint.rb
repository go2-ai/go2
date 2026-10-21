module Accounting
  # Decimals are rendered as strings to keep full precision.
  class CurrencyRevaluationItemBlueprint < Blueprinter::Base
    DECIMALS = %i[currency_balance book_base_balance rate revalued_base_balance difference].freeze

    identifier :id

    fields :account_id, :currency_id, :rate_date, :gain_loss_account_id, :excluded, :excluded_reason, :removed,
           :center1_id, :center2_id, :center3_id, :center4_id, :center5_id, :center6_id
    DECIMALS.each do |attribute|
      field attribute do |item|
        item.public_send(attribute)&.to_s("F")
      end
    end

    # Printed reports: labels next to the ids, amounts as numbers.
    view :print do
      field :account_code do |item| item.account&.full_code end
      field :account_name do |item| item.account&.name end
      (1..6).each do |level|
        field :"center_#{level}_code" do |item| item.public_send("center#{level}")&.code end
        field :"center_#{level}_name" do |item| item.public_send("center#{level}")&.name end
      end
      # "code - name" of each center, joined with " / ".
      field :centers do |item|
        (1..6).filter_map { |level| item.public_send("center#{level}") }.map { |c| "#{c.code} - #{c.name}" }.join(" / ")
      end
      field :currency do |item| item.currency&.abr end
      field :currency_decimal_digits do |item| item.currency&.decimal_digits end
      # Formatted with the currency's decimals (they differ per row).
      field :currency_balance_text do |item|
        ActiveSupport::NumberHelper.number_to_rounded(item.currency_balance, precision: item.currency&.decimal_digits || 2,
                                                                             delimiter: ",")
      end
      DECIMALS.each do |attribute|
        field attribute do |item|
          item.public_send(attribute)&.to_f
        end
      end
      field :rate_date do |item| item.rate_date&.iso8601 end
      field :posted_difference do |item| item.postable? ? item.difference.to_f : 0 end
      field :gain_loss_account_code do |item| item.gain_loss_account&.full_code end
      field :gain_loss_account_name do |item| item.gain_loss_account&.name end
      field :note do |item|
        if item.excluded_reason.present?
          Accounting::CurrencyRevaluation.model_t("excluded_reasons.#{item.excluded_reason}")
        elsif item.difference.zero?
          Accounting::CurrencyRevaluation.model_t("excluded_reasons.no_change")
        end
      end
    end
  end
end
