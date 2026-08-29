module Accounting
  class Account < ApplicationRecord
    include TranslationHelper
    has_paper_trail

    extend Mobility
    translates :name

    belongs_to :ledger, class_name: "Accounting::Ledger"
    belongs_to :parent_account, class_name: "Accounting::Account", foreign_key: "contra_for_id", optional: true
    has_many :contra_account, class_name: "Accounting::Account", foreign_key: "contra_for_id", dependent: :nullify
    delegate :account_category, :organization, :accounting_setting, to: :ledger

    validates :code, presence: true, uniqueness: { scope: :ledger_id }
    validate :code_length_matches

    def full_code
      "#{account_category.code}#{ledger.code}#{code}"
    end

    private

    def code_length_matches
      expected_length = accounting_setting.account_length
      return if expected_length.blank?

      unless code.to_s.length == expected_length
        errors.add(:code, model_t("errors.code_length_mismatch", length: expected_length))
      end
    end
  end
end
