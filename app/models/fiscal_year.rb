class FiscalYear < ApplicationRecord
  include TranslationHelper

  has_paper_trail

  extend Mobility
  translates :name

  belongs_to :organization
  belongs_to :closing_started_by, class_name: "Member", optional: true
  belongs_to :closed_by, class_name: "Member", optional: true

  has_many :journal_entries, class_name: "Accounting::JournalEntry"
  # Closing, ending and beginning entries generated while closing this year.
  # The beginning entry belongs to the next fiscal year but its source is
  # the year being closed.
  has_many :closing_entries, class_name: "Accounting::JournalEntry", as: :source
  has_many :currency_revaluations, class_name: "Accounting::CurrencyRevaluation", dependent: :restrict_with_error

  # open:    entries can be changed normally.
  # closing: the closing wizard is running; only the closing services may
  #          change entries, so balances don't move between steps.
  # closed:  read-only.
  enum :status, { open: 0, closing: 1, closed: 2 }
  enum :closing_step,
       # renumber (optional, right after starting) was added later, hence 6.
       { readiness: 0, renumber: 6, revaluation: 1, temp_closing: 2, ending: 3, beginning: 4, finalized: 5 },
       prefix: :step

  validates :start_date, presence: true
  validates :finish_date, presence: true
  validates_non_empty_translation :name, locales: ->(fy) { [ fy.organization&.locale ] }

  validate :start_date_not_after_finish_date
  validate :no_gap_or_overlap_with_existing_fiscal_years
  validate :dates_fixed_unless_open

  before_destroy :ensure_open_on_destroy

  scope :containing, ->(date) { where("start_date <= :date AND finish_date >= :date", date: date) }

  # The fiscal year that starts the day after this one finishes.
  def next_fiscal_year
    organization.fiscal_years.find_by(start_date: finish_date + 1.day)
  end

  # The year receiving the beginning entry: the one recorded when closing
  # started, else the next fiscal year (it may have been created since).
  def closing_next_fiscal_year
    id = closing_data["next_fiscal_year_id"]
    (id && organization.fiscal_years.find_by(id: id)) || next_fiscal_year
  end

  # The fiscal year that finishes the day before this one starts.
  def previous_fiscal_year
    organization.fiscal_years.find_by(finish_date: start_date - 1.day)
  end

  private

  def dates_fixed_unless_open
    return if status_in_database.nil? || status_in_database == "open"
    return unless will_save_change_to_start_date? || will_save_change_to_finish_date?

    errors.add(:base, model_t("errors.dates_fixed_unless_open"))
  end

  def ensure_open_on_destroy
    return if status_in_database == "open"

    errors.add(:base, model_t("errors.destroy_only_open"))
    throw :abort
  end

  def start_date_not_after_finish_date
    return if start_date.blank? || finish_date.blank?

    if start_date > finish_date
      errors.add(:start_date, model_t("errors.start_date_not_after_finish_date"))
    end
  end

  def no_gap_or_overlap_with_existing_fiscal_years
    return if start_date.blank? || finish_date.blank? || organization.blank?

    previous_fiscal_year = organization.fiscal_years
      .where.not(id: id)
      .where("finish_date < ?", start_date)
      .order(finish_date: :desc)
      .first

    if previous_fiscal_year && start_date != previous_fiscal_year.finish_date + 1.day
      errors.add(
        :start_date,
        model_t("errors.gap_or_overlap", previous_finish_date: previous_fiscal_year.finish_date)
      )
      return
    end

    # Check that the next fiscal year starts exactly one day after this one ends
    next_fiscal_year = organization.fiscal_years
      .where.not(id: id)
      .where("start_date > ?", finish_date)
      .order(start_date: :asc)
      .first

    if next_fiscal_year && next_fiscal_year.start_date != finish_date + 1.day
      errors.add(
        :finish_date,
        model_t("errors.gap_or_overlap_with_next", next_start_date: next_fiscal_year.start_date)
      )
      return
    end

    overlapping = organization.fiscal_years
      .where.not(id: id)
      .where("start_date <= ? AND finish_date >= ?", finish_date, start_date)

    if overlapping.exists?
      errors.add(:base, model_t("errors.overlap_with_existing"))
    end
  end
end
