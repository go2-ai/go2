module Reporting
  class ReportGrantBlueprint < Blueprinter::Base
    identifier :id

    fields :report_id, :grantee_type, :grantee_id, :access, :created_at
    field :grantee_name do |grant| grant.grantee.try(:name) end
  end
end
