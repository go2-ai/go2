# app/systems/accounting/services/reports/explorer_template.rb
module Accounting
  module Reports
    # The system print template of the explorer (A4 portrait): the grouped
    # balances shown on the page, with their totals. Labels come from
    # reports.explorer in config/locales.
    class ExplorerTemplate < ExplorerPrintTemplate
      REPORT_KEY = "explorer".freeze

      private

      def label_scope
        "explorer"
      end

      def orientation
        "portrait"
      end

      def header_fields
        [
          [ "period", shared_label("period"), period_value ],
          [ "group_by", label("grouped_by"), "{{ summary[0].group_by_name }}" ],
          [ "states", shared_label("states"), "{{ summary[0].states_text }}" ],
          [ "currency", shared_label("currency"), "{{ summary[0].currency.abr }}" ]
        ]
      end

      def columns
        [
          { id: "code", title: label("code"), width: 30, value: "{{ row.code }}" },
          { id: "name", title: label("name"), width: 64, value: "{{ row.name }}", grow: true },
          { id: "sum_debit", title: label("sum_debit"), width: 24, value: "{{ row.sum_debit }}", align: "right", format: amount },
          { id: "sum_credit", title: label("sum_credit"), width: 24, value: "{{ row.sum_credit }}", align: "right", format: amount },
          { id: "debit_balance", title: label("debit_balance"), width: 24, value: "{{ row.debit_balance }}",
            align: "right", format: amount },
          { id: "credit_balance", title: label("credit_balance"), width: 24, value: "{{ row.credit_balance }}",
            align: "right", format: amount }
        ]
      end

      def totals
        {
          "sum_debit" => "{{ summary[0].total_debit }}",
          "sum_credit" => "{{ summary[0].total_credit }}",
          "debit_balance" => "{{ summary[0].total_debit_balance }}",
          "credit_balance" => "{{ summary[0].total_credit_balance }}"
        }
      end

      def sort
        [ { "expression" => "row.code", "direction" => "asc" } ]
      end

      def report_fields
        [
          field("group_by"), field("group_by_name"), field("hide_zero_balance", "boolean"),
          *%w[total_debit total_credit total_debit_balance total_credit_balance].map { |name| field(name, "number") }
        ]
      end

      def line_path
        "root.rows"
      end

      def line_fields
        [ field("code"), field("name"), *%w[sum_debit sum_credit debit_balance credit_balance].map { |name| field(name, "number") } ]
      end
    end
  end
end
