module Reporting
  module Reports
    # Copies a report (system preset or organization report) into an
    # organization. The report type copies what the report computes (e.g.
    # the statement layout); the copy keeps a link to its source.
    class Copy
      def self.call(...)
        new(...).call
      end

      def initialize(source:, organization:, created_by: nil, name: nil)
        @source = source
        @organization = organization
        @created_by = created_by
        @name = name
      end

      def call
        raise ArgumentError, "report belongs to another organization" unless copyable?

        ActiveRecord::Base.transaction do
          copy = Reporting::Report.new(
            organization: organization,
            report_type: source.report_type,
            category: source.category,
            standard: source.standard,
            statement_type: source.statement_type,
            settings: source.settings,
            parent_report: source,
            created_by: created_by,
            # The first report of a statement type becomes the primary one.
            primary: primary_free?
          )
          copy.write_attribute(:name, name.present? ? name : copy_names)
          copy.write_attribute(:description, source.read_attribute(:description))
          copy.save!
          source.type_definition.copy_content(source, copy)
          copy
        end
      end

      private

      attr_reader :source, :organization, :created_by, :name

      def copyable?
        source.system? || source.organization_id == organization.id
      end

      def primary_free?
        return false if source.statement_type.blank?

        !organization_reports.active.where(statement_type: source.statement_type, primary: true).exists?
      end

      def organization_reports
        Reporting::Report.where(organization: organization)
      end

      # Uses the source's names when they are free in the organization,
      # else "<name> (copy)".
      def copy_names
        source.read_attribute(:name).to_h.each_with_object({}) do |(locale, value), names|
          next if value.blank?

          taken = organization_reports.where("name ->> ? = ?", locale, value).exists?
          names[locale] = taken ? I18n.with_locale(locale) { Reporting::Report.model_t("copy_name", name: value) } : value
        end
      end
    end
  end
end
