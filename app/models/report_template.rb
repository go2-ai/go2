class ReportTemplate < ApplicationRecord
  include TranslationHelper

  extend Mobility
  translates :name

  has_paper_trail

  belongs_to :organization, optional: true
  belongs_to :created_by, class_name: "Member", optional: true
  belongs_to :parent_template, class_name: "ReportTemplate", optional: true
  has_many :child_templates, class_name: "ReportTemplate", foreign_key: "parent_template_id"

  validates :report_key, :template_file, presence: true
  # validates :report_key, uniqueness: { scope: :organization_id }, if: -> { organization_id.present? }

  scope :system, -> { where(organization_id: nil) }
  scope :for_organization, ->(org_id) { where(organization_id: [ nil, org_id ]) }

  before_save :ensure_single_default_per_key, if: :is_default_changed?

  def system?
    organization_id.nil?
  end

  def org_specific?
    !system?
  end

  private

  def ensure_single_default_per_key
    return unless is_default?
    return unless organization_id.present?

    ReportTemplate
      .where(organization_id: organization_id, report_key: report_key, is_default: true)
      .where.not(id: id)
      .update_all(is_default: false)
  end
end
