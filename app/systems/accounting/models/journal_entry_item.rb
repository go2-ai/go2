# app/systems/accounting/models/journal_entry_item.rb
module Accounting
  class JournalEntryItem < ApplicationRecord
    include TranslationHelper
    has_paper_trail

    extend Mobility
    translates :description

    # ── Associations ──────────────────────────────────────────────────────
    belongs_to :journal_entry, class_name: "Accounting::JournalEntry", inverse_of: :items
    belongs_to :account, class_name: "Accounting::Account", optional: true
    belongs_to :currency, class_name: "Accounting::Currency", optional: true
    belongs_to :center1, class_name: "Accounting::Center", optional: true
    belongs_to :center2, class_name: "Accounting::Center", optional: true
    belongs_to :center3, class_name: "Accounting::Center", optional: true
    belongs_to :center4, class_name: "Accounting::Center", optional: true
    belongs_to :center5, class_name: "Accounting::Center", optional: true
    belongs_to :center6, class_name: "Accounting::Center", optional: true

    # ── Delegations ───────────────────────────────────────────────────────
    delegate :organization, :fiscal_year, :state, to: :journal_entry, allow_nil: true

    # ── Validations ───────────────────────────────────────────────────────
    validates :row, presence: true
    validates :debit, :credit,
              numericality: { greater_than_or_equal_to: 0 }
    validates :rate, :currency_amount,
              numericality: { greater_than_or_equal_to: 0, allow_nil: true }

    validate :account_required_for_non_draft
    validate :centers_required_for_non_draft
    validate :debit_xor_credit
    validate :amounts_consistent_for_non_draft

    # ── Callbacks ─────────────────────────────────────────────────────────
    before_validation :set_default_currency_and_rate
    before_validation :calculate_currency_amount,
                      if: -> { (debit_changed? || credit_changed? || rate_changed?) && !main_currency? }
    private

    def set_default_currency_and_rate
      self.currency ||= organization&.accounting_setting&.main_currency
      self.rate ||= 1.0 unless main_currency?
    end

    def main_currency?
      currency == organization&.accounting_setting&.main_currency
    end

    def account_required_for_non_draft
      return if journal_entry.nil? || journal_entry.draft?
      errors.add(:account, model_t("errors.account_required")) if account.blank?
    end

    def centers_required_for_non_draft
      return if journal_entry.nil? || journal_entry.draft?
      return if account.blank?

      1.upto(6) do |level|
        allowed = account.public_send("allowed_center_types_#{level}")
        next if allowed.blank?

        center = public_send("center#{level}")
        errors.add("center#{level}_id", model_t("errors.center_required")) if center.blank?
      end
    end

    def debit_xor_credit
      if debit.positive? && credit.positive?
        errors.add(:base, model_t("errors.debit_xor_credit"))
      elsif debit.zero? && credit.zero?
        errors.add(:base, model_t("errors.debit_or_credit_required"))
      end
    end

    def amounts_consistent_for_non_draft
      return if journal_entry.nil? || journal_entry.draft?
      return if debit.zero? && credit.zero?
      return if rate.nil? || rate.zero?

      expected = (debit - credit).abs / rate
      unless (currency_amount - expected).abs < 0.000000000001
        errors.add(:currency_amount, model_t("errors.currency_amount_mismatch"))
      end
    end

    def calculate_currency_amount
      return if rate.nil? || rate.zero?
      self.currency_amount = (debit - credit).abs / rate
    end
  end
end
