class ReportTemplate < ApplicationRecord
  include TranslationHelper

  extend Mobility
  translates :name

  has_paper_trail

  # Ariana Reports templates are JSON documents. Images are usually embedded
  # as data URIs, so allow a generous size but keep an upper bound.
  MAX_TEMPLATE_SIZE = 5.megabytes

  # System templates whose layout depends on the organization (e.g. one
  # column per center level). They are generated when served or copied;
  # the stored file is the default (3 center levels).
  GENERATED_SYSTEM_TEMPLATES = {
    "currency_revaluation" => ->(organization) { Accounting::Reports::CurrencyRevaluationTemplate.for(organization).to_json }
  }.freeze

  belongs_to :organization, optional: true
  belongs_to :created_by, class_name: "Member", optional: true
  belongs_to :parent_template, class_name: "ReportTemplate", optional: true
  has_many :child_templates, class_name: "ReportTemplate", foreign_key: "parent_template_id", dependent: :nullify

  validates :report_key, :template_file, presence: true
  validate :template_file_must_be_json_object

  scope :system, -> { where(organization_id: nil) }
  scope :for_organization, ->(org_id) { where(organization_id: [ nil, org_id ]) }

  before_save :ensure_single_default_per_key, if: :is_default_changed?

  # Builds an organization-specific copy of this template. New templates are
  # always created this way, so every template starts from a working layout.
  def build_copy(organization:, created_by:, name: nil)
    copy = organization.report_templates.new(
      report_key: report_key,
      template_file: template_file_for(organization),
      parent_template: self,
      created_by: created_by,
      is_default: false
    )
    copy.write_attribute(:name, name.presence || copy_names)
    copy
  end

  def system?
    organization_id.nil?
  end

  # The template as used by an organization: generated system templates are
  # built for it; everything else is the stored file.
  def template_file_for(organization)
    generator = system? && organization && GENERATED_SYSTEM_TEMPLATES[report_key]
    generator ? generator.call(organization) : template_file
  end

  def org_specific?
    !system?
  end

  private

  def copy_names
    source = read_attribute(:name).presence || { I18n.locale.to_s => report_key }
    source.each_with_object({}) do |(locale, value), names|
      next if value.blank?

      translation_locale = I18n.available_locales.map(&:to_s).include?(locale.to_s) ? locale : I18n.default_locale
      names[locale] = I18n.with_locale(translation_locale) { model_t("copy_name", name: value) }
    end
  end

  def template_file_must_be_json_object
    return if template_file.blank?

    if template_file.bytesize > MAX_TEMPLATE_SIZE
      errors.add(:template_file, model_t("errors.too_large", size: ActiveSupport::NumberHelper.number_to_human_size(MAX_TEMPLATE_SIZE)))
      return
    end

    parsed = JSON.parse(template_file)
    errors.add(:template_file, model_t("errors.invalid_json")) unless parsed.is_a?(Hash)
  rescue JSON::ParserError
    errors.add(:template_file, model_t("errors.invalid_json"))
  end

  def ensure_single_default_per_key
    return unless is_default?
    return unless organization_id.present?

    ReportTemplate
      .where(organization_id: organization_id, report_key: report_key, is_default: true)
      .where.not(id: id)
      .update_all(is_default: false)
  end
end
