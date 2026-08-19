class FiscalYear < ApplicationRecord
  include TranslationHelper

  has_paper_trail

  extend Mobility
  translates :name

  belongs_to :organization

  validates :start_date, presence: true
  validates :finish_date, presence: true
  validates_non_empty_translation :name, locales: ->(fy) { [ fy.organization&.locale ] }

  validate :start_date_not_after_finish_date
  validate :no_gap_or_overlap_with_existing_fiscal_years

  private

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
