module Accounting
  class Currency < ApplicationRecord
    include TranslationHelper
    has_paper_trail

    extend Mobility
    translates :name

    belongs_to :organization

    has_one :accounting_setting, class_name: "Accounting::Setting", foreign_key: "main_currency_id", dependent: :nullify
    has_many :exchange_rates, class_name: "Accounting::ExchangeRate", dependent: :destroy
    has_many :quoted_exchange_rates, class_name: "Accounting::ExchangeRate",
             foreign_key: :quote_currency_id, dependent: :destroy
    has_one :exchange_rate_source, class_name: "Accounting::ExchangeRateSource", dependent: :destroy
    has_many :quoted_exchange_rate_sources, class_name: "Accounting::ExchangeRateSource",
             foreign_key: :quote_currency_id, dependent: :nullify

    validates :abr, presence: true, uniqueness: { scope: :organization_id }
    validates :decimal_digits, presence: true
    validates_non_empty_translation :name, locales: ->(currency) { [ currency.organization&.locale ] }
  end
end
