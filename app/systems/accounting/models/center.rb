module Accounting
  class Center < ApplicationRecord
    include TranslationHelper
    has_paper_trail

    extend Mobility
    translates :name

    belongs_to :center_type, class_name: "Accounting::CenterType"
    belongs_to :centerable, polymorphic: true, optional: true

    delegate :organization, to: :center_type, allow_nil: true
    delegate :accounting_setting, to: :organization, allow_nil: true

    validates_non_empty_translation :name, locales: ->(center) { [ center.organization&.locale ] }

    validates :code, presence: true, uniqueness: { scope: :center_type_id, message: ->(ct, _) { ct.model_t("errors.code_already_taken") } }
    validate :code_within_center_type_range
    validate :code_matches_center_length

    private

    def code_within_center_type_range
      return if center_type.blank? || code.blank?

      code_int = code.to_i
      first_int = center_type.first_code.to_i
      last_int = center_type.last_code.to_i

      unless code_int.between?(first_int, last_int)
        errors.add(:code, model_t("errors.code_out_of_range",
                                   first: center_type.first_code,
                                   last: center_type.last_code))
      end
    end

    def code_matches_center_length
      return if center_type.blank? || code.blank?

      expected_length = accounting_setting&.center_length
      return if expected_length.blank?

      unless code.length == expected_length
        errors.add(:code, model_t("errors.code_length_mismatch", length: expected_length))
      end
    end
  end
end
