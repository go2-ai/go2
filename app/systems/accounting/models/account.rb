module Accounting
  class Account < ApplicationRecord
    include TranslationHelper
    include Accounting::FxAccountOverrides
    has_paper_trail

    extend Mobility
    translates :name

    belongs_to :ledger, class_name: "Accounting::Ledger"
    belongs_to :parent_account, class_name: "Accounting::Account", foreign_key: "contra_for_id", optional: true
    has_many :contra_account, class_name: "Accounting::Account", foreign_key: "contra_for_id", dependent: :nullify
    delegate :account_category, :organization, :accounting_setting, to: :ledger

    validates :code, presence: true, uniqueness: { scope: :ledger_id }
    validate :code_length_matches
    validate :other_currencies_kept_while_used, on: :update

    def full_code
      "#{account_category.code}#{ledger.code}#{code}"
    end

    # Whether journal entry items of this account use a currency other than
    # the main one (then it must keep accepting other currencies).
    def foreign_currency_items?
      main_currency_id = accounting_setting&.main_currency_id
      items = Accounting::JournalEntryItem.where(account_id: id)
      items = items.where.not(currency_id: main_currency_id) if main_currency_id
      items.exists?
    end

    private

    def other_currencies_kept_while_used
      return unless will_save_change_to_accepts_other_currencies? && !accepts_other_currencies
      return unless foreign_currency_items?

      errors.add(:accepts_other_currencies, model_t("errors.foreign_currency_items_exist"))
    end

    def code_length_matches
      expected_length = accounting_setting.account_length
      return if expected_length.blank?

      unless code.to_s.length == expected_length
        errors.add(:code, model_t("errors.code_length_mismatch", length: expected_length))
      end
    end
  end
end
