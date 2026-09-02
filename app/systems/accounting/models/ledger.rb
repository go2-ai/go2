# app/systems/accounting/models/ledger.rb
module Accounting
  class Ledger < ApplicationRecord
    include TranslationHelper
    has_paper_trail

    extend Mobility
    translates :name

    belongs_to :account_category, class_name: "Accounting::AccountCategory"
    delegate :organization, to: :account_category
    delegate :accounting_setting, to: :organization
    belongs_to :parent_ledger, class_name: "Accounting::Ledger", foreign_key: "contra_for_id", optional: true
    has_many :contra_ledgers, class_name: "Accounting::Ledger", foreign_key: "contra_for_id", dependent: :destroy
    has_many :accounts, class_name: "Account", dependent: :destroy

    validates :code, presence: true, uniqueness: { scope: :account_category_id }

    enum :unexpected_balance, { accept: 1, warn: 2, disallow: 3 }
    validates :unexpected_balance, presence: true
    validate :code_length_matches

    def balance_type
      return "debit" if [ "CA", "LA", "EX" ].include?(account_category.identifier)
      return "credit" if [ "CL", "LL", "RE", "OE" ].include?(account_category.identifier)
      nil
    end

    def full_code
      "#{account_category.code}#{code}"
    end

    private

    def code_length_matches
      expected_length = accounting_setting.ledger_length
      return if expected_length.blank?

      unless code.to_s.length == expected_length
        errors.add(:code, model_t("errors.code_length_mismatch", length: expected_length))
      end
    end
  end
end
