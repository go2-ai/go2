# app/systems/accounting/models/exchange_rate_source.rb
module Accounting
  # Where a currency's exchange rates come from: entered manually or fetched
  # from a provider. Provider rates are stored quoted in `quote_currency`
  # (the main currency when blank) and converted to the main currency
  # through that currency's own rate when needed.
  class ExchangeRateSource < ApplicationRecord
    include TranslationHelper
    has_paper_trail

    PROVIDERS = [ ExchangeRate::MANUAL, "ecb" ].freeze

    belongs_to :organization
    belongs_to :currency, class_name: "Accounting::Currency"
    belongs_to :quote_currency, class_name: "Accounting::Currency", optional: true

    validates :provider, inclusion: { in: PROVIDERS }
    validates :currency_id, uniqueness: { scope: :organization_id,
                                          message: ->(record, _) { record.model_t("errors.duplicate") } }
    validate :currencies_belong_to_organization
    validate :currency_is_not_main
    validate :quote_differs_from_currency

    before_validation :normalize_quote_currency

    scope :active, -> { where(active: true) }

    def manual?
      provider == ExchangeRate::MANUAL
    end

    private

    def main_currency_id
      organization&.accounting_setting&.main_currency_id
    end

    def normalize_quote_currency
      self.quote_currency_id = nil if quote_currency_id.present? && quote_currency_id == main_currency_id
    end

    def currencies_belong_to_organization
      [ [ :currency_id, currency ], [ :quote_currency_id, quote_currency ] ].each do |attribute, record|
        next if record.nil? || record.organization_id == organization_id

        errors.add(attribute, model_t("errors.currency_not_in_organization"))
      end
    end

    def currency_is_not_main
      return if currency_id.blank? || currency_id != main_currency_id

      errors.add(:currency_id, model_t("errors.main_currency"))
    end

    def quote_differs_from_currency
      return if quote_currency_id.blank? || quote_currency_id != currency_id

      errors.add(:quote_currency_id, model_t("errors.same_currency"))
    end
  end
end
