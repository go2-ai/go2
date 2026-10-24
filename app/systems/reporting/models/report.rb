module Reporting
  # An entry of the report catalog. System reports (no organization) are
  # presets maintained in code and are read-only; organizations customize
  # copies of them. What a report computes is up to its report type (see
  # Reporting::ReportTypes), e.g. a statement layout for
  # "accounting.statement".
  class Report < ApplicationRecord
    include TranslationHelper
    has_paper_trail

    extend Mobility
    translates :name, :description

    CATEGORIES = %w[financial_statements general_ledger analysis].freeze


    belongs_to :organization, optional: true
    belongs_to :parent_report, class_name: "Reporting::Report", optional: true
    belongs_to :created_by, class_name: "Member", optional: true
    has_many :copies, class_name: "Reporting::Report", foreign_key: :parent_report_id, dependent: :nullify,
                      inverse_of: :parent_report
    has_many :grants, class_name: "Reporting::ReportGrant", dependent: :destroy, inverse_of: :report
    # AI chats about the report (the mapping assistant).
    has_many :ai_chats, as: :subject, dependent: :destroy
    has_one :statement_layout, class_name: "Accounting::StatementLayout", dependent: :destroy, inverse_of: :report

    validates :report_type, presence: true
    validate :report_type_registered
    validates :category, inclusion: { in: CATEGORIES }
    validates :key, uniqueness: { conditions: -> { where(organization_id: nil) } }, if: :system?
    validates :name, presence: true

    scope :system, -> { where(organization_id: nil) }
    scope :active, -> { where(archived_at: nil) }
    # The organization's own reports and the system presets.
    scope :available_to, ->(organization) { where(organization_id: [ nil, organization.id ]) }

    def system?
      organization_id.nil?
    end

    def archived?
      archived_at.present?
    end

    def type_definition
      Reporting::ReportTypes.fetch(report_type)
    end

    private


    def report_type_registered
      return if report_type.blank? || Reporting::ReportTypes.registered?(report_type)

      errors.add(:report_type, :inclusion)
    end
  end
end
