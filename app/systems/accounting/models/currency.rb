module Accounting
  class Currency < ApplicationRecord
    include TranslationHelper
    has_paper_trail

    extend Mobility
    translates :name

    belongs_to :organization

    has_one :accounting_setting, class_name: "Accounting::Setting", foreign_key: "main_currency_id", dependent: :nullify

    validates :abr, presence: true, uniqueness: { scope: :organization_id }
    validates :decimal_digits, presence: true
    validates_non_empty_translation :name, locales: ->(currency) { [ currency.organization&.locale ] }
  end
end
