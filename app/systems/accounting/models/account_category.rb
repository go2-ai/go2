module Accounting
  class AccountCategory < ApplicationRecord
    include TranslationHelper
    has_paper_trail

    extend Mobility
    translates :name

    belongs_to :organization

    has_many :ledgers, dependent: :destroy
    has_many :accounts, through: :ledgers

    self.inheritance_column = nil
    enum :type, { balance_sheet: 1, income_statement: 2, other: 3 }

    validates :code, presence: true, uniqueness: { scope: :organization_id }
    before_destroy :prevent_system_deletion, if: -> { identifier.present? }

    validate :validate_user_category_type, on: :create

    def self.system_categories
      [
        { identifier: "CA", name: model_t("identifiers.CA"), code: 1, type: :balance_sheet },
        { identifier: "LA", name: model_t("identifiers.LA"), code: 2, type: :balance_sheet },
        { identifier: "CL", name: model_t("identifiers.CL"), code: 3, type: :balance_sheet },
        { identifier: "LL", name: model_t("identifiers.LL"), code: 4, type: :balance_sheet },
        { identifier: "OE", name: model_t("identifiers.OE"), code: 5, type: :balance_sheet },
        { identifier: "RE", name: model_t("identifiers.RE"), code: 6, type: :income_statement },
        { identifier: "EX", name: model_t("identifiers.EX"), code: 7, type: :income_statement },
        { identifier: "CO", name: model_t("identifiers.CO"), code: 8, type: :other },
        { identifier: "ME", name: model_t("identifiers.ME"), code: 9, type: :other }
      ]
    end

    private

    def prevent_system_deletion
      errors.add(:base, "System account categories cannot be deleted")
      throw(:abort)
    end

    def validate_user_category_type
      return if identifier.present?

      # Normalize: accept symbol :other, string "other", or integer 3
      raw_type = self[:type]
      is_other = case raw_type
      when Symbol then raw_type == :other
      when String then raw_type == "other"
      when Integer then raw_type == self.class.types[:other]
      else false
      end

      return if is_other

      errors.add(:base, model_t("only_other_type"))
    end
  end
end
