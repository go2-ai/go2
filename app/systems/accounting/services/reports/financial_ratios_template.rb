module Accounting
  module Reports
    # System print template of the financial ratios (A4 portrait): ratios by
    # group for the period and the comparison, formatted as shown on
    # screen. Data: Ratios::ReportType.print. Labels: reports.financial_ratios.
    class FinancialRatiosTemplate < ComparisonPrintTemplate
      REPORT_KEY = "financial_ratios".freeze

      private

      def label_scope
        "financial_ratios"
      end

      def header_fields
        [ [ "period", shared_label("period"), "{{ summary[0].period_text }}" ], [ "states", shared_label("states"), "{{ summary[0].states_text }}" ] ]
      end

      def columns
        [
          { id: "group", title: label("group"), width: 35, value: "{{ row.group_name }}" },
          { id: "name", title: label("ratio"), width: 85, value: "{{ row.name }}", grow: true },
          { id: "current", title: "{{ summary[0].title_current }}", width: 35, value: "{{ row.current }}", align: "right" },
          { id: "previous", title: "{{ summary[0].title_previous }}", width: 35, value: "{{ row.previous }}", align: "right" }
        ]
      end

      def report_fields
        [ field("period_text"), field("comparison", "boolean"), field("title_current"), field("title_previous") ]
      end

      def line_fields
        [ field("group_name"), field("name"), field("current"), field("previous") ]
      end
    end
  end
end
