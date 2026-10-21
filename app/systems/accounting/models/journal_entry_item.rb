# app/systems/accounting/models/journal_entry_item.rb
module Accounting
  class JournalEntryItem < ApplicationRecord
    include TranslationHelper
    # The parent id is stored with every version so the journal entry's
    # change log can include item changes, also after an item was deleted.
    has_paper_trail meta: {
      metadata: ->(item) { { journal_entry_id: item.journal_entry_id } }
    }

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

    # ── Change log ────────────────────────────────────────────────────────
    # Versions of items whose parent is the given journal entry. Older
    # versions have no metadata; their parent id is in the stored attributes
    # (object = attributes before the change, object_changes for creates).
    def self.versions_for_journal_entry(journal_entry_id)
      id = journal_entry_id.to_s
      PaperTrail::Version
        .where(item_type: name)
        .where(
          "versions.metadata->>'journal_entry_id' = :id " \
          "OR versions.object_changes->'journal_entry_id'->>1 = :id " \
          "OR (versions.object IS NOT NULL AND (versions.object::jsonb)->>'journal_entry_id' = :id)",
          id: id
        )
    end

    # Short label for the change log, e.g. the row number.
    def self.version_label(version)
      attrs = version.object.present? ? (JSON.parse(version.object) rescue {}) : {}
      row = version.item&.row || attrs["row"] || version.changes.dig("row", 1)
      row.present? ? { row: row } : nil
    end

    # Readable values for reference fields in the change log.
    def self.version_display_value(field, value)
      return value if value.blank?

      case field
      when "account_id"
        account = Accounting::Account.includes(ledger: :account_category).find_by(id: value)
        account ? "#{account.full_code} - #{account.name}" : value
      when /\Acenter\d_id\z/
        center = Accounting::Center.find_by(id: value)
        center ? "#{center.code} - #{center.name}" : value
      when "currency_id"
        Accounting::Currency.find_by(id: value)&.abr || value
      else
        value
      end
    end

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
                      if: -> { (debit_changed? || credit_changed? || rate_changed?) && !main_currency? && !system_generated? }
    private

    # Revaluation and closing entries set currency_amount explicitly: a
    # revaluation line changes only the main-currency amount (currency_amount
    # 0), and carried-forward balances must keep the exact foreign balance
    # instead of one derived from a rounded rate.
    def system_generated?
      journal_entry&.system_generated? || false
    end

    # System-generated lines set their rate explicitly; lines that change
    # only the main-currency amount (revaluation, closing remainders) have none.
    def set_default_currency_and_rate
      self.currency ||= organization&.accounting_setting&.main_currency
      self.rate ||= 1.0 unless main_currency? || system_generated?
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
      return if system_generated?
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
