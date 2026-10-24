module Reporting
  # Gives a member, role, group or department access to one report.
  # `view` allows running, drilling and printing it; `edit` also allows
  # renaming an organization report and changing its lines. Its mapping
  # rules and inspection list also need Reports.manage_statements or the
  # journal entry viewing permissions (see Reporting::Access).
  class ReportGrant < ApplicationRecord
    has_paper_trail

    GRANTEE_TYPES = %w[Member Role Group Department].freeze

    enum :access, { view: 0, edit: 1 }, validate: true
    belongs_to :organization
    belongs_to :report, class_name: "Reporting::Report", inverse_of: :grants
    belongs_to :grantee, polymorphic: true

    validates :grantee_type, inclusion: { in: GRANTEE_TYPES }
    validates :grantee_id, uniqueness: { scope: [ :report_id, :grantee_type ] }
    validate :grantee_in_organization
    validate :report_available_to_organization

    private

    def grantee_in_organization
      return if grantee.nil? || organization_id.nil?
      return if grantee.respond_to?(:organization_id) && grantee.organization_id == organization_id

      errors.add(:grantee, :invalid)
    end

    def report_available_to_organization
      return if report.nil? || report.organization_id.nil? || report.organization_id == organization_id

      errors.add(:report, :invalid)
    end
  end
end
