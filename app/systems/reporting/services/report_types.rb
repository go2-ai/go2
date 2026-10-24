module Reporting
  # Registry of report types. The reporting platform knows nothing about
  # the domain of a report: each system (accounting, later payroll, ...)
  # registers its types in config/initializers/reporting.rb.
  #
  # A type is a handler module name. The handler implements:
  #   run(report, organization:, params:, access:)    JSON for the viewer
  #   drill(report, organization:, params:, access:)  breakdown of a figure
  #   print(report, organization:, params:, access:)  data of the print
  #   copy_content(source, copy)  copies what the report computes (e.g. a
  #                               statement layout) onto a new report
  module ReportTypes
    @types = {}

    class << self
      def register(key, handler)
        @types[key.to_s] = handler.to_s
      end

      def registered?(key)
        @types.key?(key.to_s)
      end

      def fetch(key)
        @types.fetch(key.to_s).constantize
      end
    end
  end
end
