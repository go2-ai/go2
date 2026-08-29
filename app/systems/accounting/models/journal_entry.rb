# app/systems/accounting/models/journal_entry.rb
module Accounting
  class JournalEntry < ApplicationRecord
    include TranslationHelper
    has_paper_trail

    extend Mobility
    translates :description

    # ── Associations ──────────────────────────────────────────────────────
    belongs_to :organization
    belongs_to :fiscal_year
    belongs_to :creator, class_name: "Member", optional: true
    has_many :items,
             class_name: "Accounting::JournalEntryItem",
             foreign_key: :journal_entry_id,
             dependent: :destroy,
             inverse_of: :journal_entry

    accepts_nested_attributes_for :items, allow_destroy: true

    # ── Enums ─────────────────────────────────────────────────────────────
    enum :state, { draft: 0, booked: 1, approved: 2 }
    enum :entry_type, { normal: 0, beginning: 1, ending: 2 }

    # ── Validations ───────────────────────────────────────────────────────
    validates :date, presence: true
    validates :effective_date, presence: true
    validates :fiscal_year, presence: true
    validates :organization, presence: true

    validate :date_within_fiscal_year
    validate :items_present_for_booked_or_approved
    validate :debit_equals_credit_for_booked_or_approved

    # ── Callbacks ─────────────────────────────────────────────────────────
    before_validation :set_default_effective_date, on: :create
    before_save :recalculate_totals
    before_create :assign_sequential_numbers
    after_create :set_initial_state

    private

    def set_default_effective_date
      self.effective_date = date if effective_date.blank? && date.present?
    end

    def date_within_fiscal_year
      return if date.blank? || fiscal_year.blank?

      unless date.between?(fiscal_year.start_date, fiscal_year.finish_date)
        errors.add(:date, model_t("errors.date_outside_fiscal_year",
                                  start_date: fiscal_year.start_date,
                                  finish_date: fiscal_year.finish_date))
      end
    end

    def items_present_for_booked_or_approved
      return unless booked? || approved?
      return if items.any? { |item| !item.marked_for_destruction? }

      errors.add(:base, model_t("errors.items_required"))
    end

    def debit_equals_credit_for_booked_or_approved
      return unless booked? || approved?

      total_debit = items.reject(&:marked_for_destruction?).sum(&:debit)
      total_credit = items.reject(&:marked_for_destruction?).sum(&:credit)

      unless total_debit == total_credit
        errors.add(:base, model_t("errors.unbalanced"))
      end
    end

    def recalculate_totals
      self.debit = items.reject(&:marked_for_destruction?).sum(&:debit)
      self.credit = items.reject(&:marked_for_destruction?).sum(&:credit)
    end

    def assign_sequential_numbers
      self.ref = next_sequential_number
      self.no = ref
      self.daily_no = next_daily_number
    end

    def next_sequential_number
      last = organization.journal_entries
                .where(fiscal_year: fiscal_year)
                .maximum(:ref)
      (last.to_i + 1).to_s
    end

    def next_daily_number
      last_daily = organization.journal_entries
                    .where(fiscal_year: fiscal_year, date: date)
                    .maximum(:daily_no)
      last_daily.to_i + 1
    end

    def set_initial_state
      update_column(:state, :draft) if state.blank?
    end
  end
end
