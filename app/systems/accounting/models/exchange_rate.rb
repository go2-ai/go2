# app/systems/accounting/models/exchange_rate.rb
module Accounting
  # 1 unit of `currency` equals `rate` units of `quote_currency` on `date`.
  # A blank quote currency means the organization's main currency. Use
  # Accounting::ExchangeRates::Resolver to get a rate in the main currency.
  class ExchangeRate < ApplicationRecord
    include TranslationHelper
    has_paper_trail

    MANUAL = "manual".freeze
    SOURCES = [ MANUAL, "ecb" ].freeze

    belongs_to :organization
    belongs_to :currency, class_name: "Accounting::Currency"
    belongs_to :quote_currency, class_name: "Accounting::Currency", optional: true
    belongs_to :created_by, class_name: "Member", optional: true

    validates :date, presence: true
    validates :rate, presence: true, numericality: { greater_than: 0 }
    validates :source, inclusion: { in: SOURCES }
    validates :date, uniqueness: { scope: %i[organization_id currency_id source],
                                   message: ->(record, _) { record.model_t("errors.duplicate") } }
    validate :currencies_belong_to_organization
    validate :currency_is_not_main
    validate :quote_differs_from_currency

    before_validation :normalize_quote_currency

    scope :on_or_before, ->(date) { where(date: ..date) }

    def manual?
      source == MANUAL
    end

    # The currency the rate is quoted in, the main currency when blank.
    def effective_quote_currency_id
      quote_currency_id || main_currency_id
    end

    private

    def main_currency_id
      organization&.accounting_setting&.main_currency_id
    end

    # Quoting against the main currency is stored as blank.
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
