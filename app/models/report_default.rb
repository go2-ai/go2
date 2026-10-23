# The default template of a report: for the whole organization (no member)
# or a member's own choice, which wins over the organization's. It can point
# at any template the organization can see, in any locale, including system
# templates. See ReportTemplates::Resolver.
class ReportDefault < ApplicationRecord
  include TranslationHelper

  belongs_to :organization
  belongs_to :member, optional: true
  belongs_to :report_template

  validates :report_key, presence: true, inclusion: { in: ->(_) { ReportRegistry.keys } }
  validates :report_key, uniqueness: { scope: [ :organization_id, :member_id ] }
  validate :template_fits

  scope :organization_wide, -> { where(member_id: nil) }

  def personal?
    member_id.present?
  end

  private

  def template_fits
    if report_template
      errors.add(:report_template, model_t("errors.other_report")) if report_template.report_key != report_key
      unless report_template.system? || report_template.organization_id == organization_id
        errors.add(:report_template, model_t("errors.not_available"))
      end
    end
    errors.add(:member, model_t("errors.other_organization")) if member && member.organization_id != organization_id
  end
end
