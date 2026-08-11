module Accounting
  class CenterType < ApplicationRecord
    include TranslationHelper
    has_paper_trail

    extend Mobility
    translates :name

    belongs_to :organization

    has_many :centers, class_name: "Accounting::Center"

    validates_non_empty_translation :name, locales: ->(ct) { [ ct.organization&.locale ] }
    validates_uniqueness_of_translated :name, scope: :organization_id

    validates :first_code, :last_code, presence: true
    validate :first_code_not_greater_than_last_code
    validate :no_overlapping_code_ranges
    validate :no_centers_outside_range, on: :update


    private

    def first_code_not_greater_than_last_code
      return if first_code.blank? || last_code.blank?
      return unless first_code.to_i > last_code.to_i

      errors.add(:first_code, model_t("errors.codes.first_greater_than_last"))
    end

    def no_overlapping_code_ranges
      return if first_code.blank? || last_code.blank?

      scope = organization.center_types
      scope = scope.where.not(id: id) if persisted?

      # Fully inclusive on both ends: [first_code, last_code]
      overlapping = scope.where(
        "CAST(first_code AS integer) <= ? AND CAST(last_code AS integer) >= ?",
        last_code.to_i, first_code.to_i
      )

      return unless overlapping.exists?

      errors.add(:base, model_t("errors.codes.overlap"))
    end

    def no_centers_outside_range
      return if first_code.blank? || last_code.blank?
      return unless first_code_changed? || last_code_changed?

      first_int = first_code.to_i
      last_int = last_code.to_i

      out_of_range = centers.where.not(
        "CAST(code AS integer) BETWEEN ? AND ?", first_int, last_int
      )

      if out_of_range.exists?
        codes = out_of_range.pluck(:code).join(", ")
        errors.add(:base, model_t("errors.centers_out_of_range", codes: codes))
      end
    end
  end
end
