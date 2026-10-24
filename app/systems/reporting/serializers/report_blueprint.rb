module Reporting
  # options: access (Reporting::Access) for the current user's flags.
  class ReportBlueprint < Blueprinter::Base
    identifier :id

    fields :report_type, :key, :category, :standard, :statement_type, :name, :description, :primary,
           :parent_report_id, :organization_id, :archived_at, :updated_at

    field :system do |report| report.system? end
    field :names do |report| report.read_attribute(:name) || {} end
    field :descriptions do |report| report.read_attribute(:description) || {} end
    field :permissions do |report, options|
      options[:access] ? options[:access].flags(report) : {}
    end
  end
end
