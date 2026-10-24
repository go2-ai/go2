module Accounting
  module Reports
    # System print template of financial statements (A4 portrait): one row
    # per statement line, indented by depth and bold where the line is,
    # with the current column and, when compared, the previous one and the
    # change. Data: Statements::ReportType.print. Labels: reports.financial_statement.
    class FinancialStatementTemplate < ComparisonPrintTemplate
      REPORT_KEY = "financial_statement".freeze

      private

      def label_scope
        "financial_statement"
      end

      def comparison_ids
        %w[previous variance]
      end

      def header_fields
        [
          [ "period", shared_label("period"), "{{ summary[0].period_text }}" ],
          [ "states", shared_label("states"), "{{ summary[0].states_text }}" ],
          [ "currency", shared_label("currency"), "{{ summary[0].currency.abr }}" ]
        ]
      end

      def page_header
        components = super
        # The statement's own name replaces the generic title.
        title = components.find { |component| component["id"] == "title" }
        title["text"] = "{{ summary[0].report_name }}" if title
        components
      end

      def columns
        [
          { id: "label", title: label("line"), width: 100, value: "{{ row.indented_label }}", grow: true },
          { id: "current", title: "{{ summary[0].title_current }}", width: 30, value: "{{ row.current }}", align: "right", format: amount },
          { id: "previous", title: "{{ summary[0].title_previous }}", width: 30, value: "{{ row.previous }}", align: "right", format: amount },
          { id: "variance", title: label("variance"), width: 30, value: "{{ row.variance }}", align: "right", format: amount }
        ]
      end

      def detail
        super.each do |component|
          component["conditions"] = [ { "expression" => "row.bold", "style" => { "fontWeight" => "bold" } },
                                      { "expression" => "row.heading", "style" => { "backgroundColor" => "#f2f2f2" } } ]
        end
      end

      def report_fields
        [ field("report_name"), field("period_text"), field("comparison", "boolean"), field("title_current"), field("title_previous") ]
      end

      def line_fields
        [ field("label"), field("indented_label"), field("depth", "number"), field("bold", "boolean"), field("heading", "boolean"),
          *%w[current previous variance].map { |name| field(name, "number") } ]
      end
    end
  end
end
