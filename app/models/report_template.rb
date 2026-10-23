class ReportTemplate < ApplicationRecord
  include TranslationHelper

  extend Mobility
  translates :name

  has_paper_trail

  # Ariana Reports templates are JSON documents. Images are usually embedded
  # as data URIs, so allow a generous size but keep an upper bound.
  MAX_TEMPLATE_SIZE = 5.megabytes

  # Templates are used when nothing exists in the requested locale or the
  # organization's locale.
  FALLBACK_LOCALE = "en".freeze

  # System templates whose layout depends on the organization (e.g. one
  # column per center level). They are generated when served or copied;
  # the stored file is the default (3 center levels).
  GENERATED_SYSTEM_TEMPLATES = {
    "currency_revaluation" => lambda { |organization, locale|
      Accounting::Reports::CurrencyRevaluationTemplate.for(organization, locale: locale).to_json
    },
    # Amounts in the decimals of the main currency.
    "explorer" => lambda { |organization, locale|
      Accounting::Reports::ExplorerTemplate.for(organization, locale: locale).to_json
    },
    "journal_entry_items" => lambda { |organization, locale|
      Accounting::Reports::JournalEntryItemsTemplate.for(organization, locale: locale).to_json
    }
  }.freeze

  belongs_to :organization, optional: true
  belongs_to :created_by, class_name: "Member", optional: true
  belongs_to :parent_template, class_name: "ReportTemplate", optional: true
  has_many :child_templates, class_name: "ReportTemplate", foreign_key: "parent_template_id", dependent: :nullify
  has_many :report_defaults, dependent: :delete_all

  validates :report_key, :template_file, presence: true
  validates :locale, inclusion: { in: ->(_) { supported_locales } }
  validate :template_file_must_be_json_object

  scope :system, -> { where(organization_id: nil) }
  scope :for_organization, ->(org_id) { where(organization_id: [ nil, org_id ]) }

  # Locales a template can be written in (the languages organizations can use).
  def self.supported_locales
    Rails.application.config.supported_locales.keys
  end

  # Builds an organization-specific copy of this template. New templates are
  # always created this way, so every template starts from a working layout.
  # The copy is in the source's locale unless another one is given (e.g. to
  # translate an English template into French).
  def build_copy(organization:, created_by:, name: nil, locale: nil)
    copy = organization.report_templates.new(
      report_key: report_key,
      locale: locale.presence || self.locale,
      template_file: template_file_for(organization),
      parent_template: self,
      created_by: created_by
    )
    copy.write_attribute(:name, name.presence || copy_names)
    copy
  end

  def system?
    organization_id.nil?
  end

  # The template as used by an organization: generated system templates are
  # built for it (in the template's locale); everything else is the stored file.
  def template_file_for(organization)
    generator = system? && organization && GENERATED_SYSTEM_TEMPLATES[report_key]
    generator ? generator.call(organization, locale) : template_file
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
end
