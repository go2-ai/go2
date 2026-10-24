module Accounting
  module Reports
    # System print template of the trial balance (A4 landscape): opening,
    # period and closing debits and credits per row, with totals. Data:
    # TrialBalance::ReportType.print. Labels: reports.trial_balance.
    class TrialBalanceTemplate < ExplorerPrintTemplate
      REPORT_KEY = "trial_balance".freeze
      AMOUNTS = %w[opening_debit opening_credit debit credit closing_debit closing_credit].freeze

      private

      def label_scope
        "trial_balance"
      end

      def orientation
        "landscape"
      end

      def header_fields
        [
          [ "period", shared_label("period"), period_value ],
          [ "level", label("level"), "{{ summary[0].level_name }}" ],
          [ "states", shared_label("states"), "{{ summary[0].states_text }}" ],
          [ "currency", shared_label("currency"), "{{ summary[0].currency.abr }}" ]
        ]
      end

      def columns
        [
          { id: "code", title: label("code"), width: 25, value: "{{ row.code }}" },
          { id: "name", title: label("name"), width: 72, value: "{{ row.name }}", grow: true },
          *AMOUNTS.map do |name|
            { id: name, title: label(name), width: 30, value: "{{ row.#{name} }}", align: "right", format: amount }
          end
        ]
      end

      def totals
        AMOUNTS.to_h { |name| [ name, "{{ summary[0].total_#{name} }}" ] }
      end

      def report_fields
        [ field("level_name"), *AMOUNTS.map { |name| field("total_#{name}", "number") } ]
      end

      def line_path
        "root.rows"
      end

      def line_fields
        [ field("code"), field("name"), *AMOUNTS.map { |name| field(name, "number") } ]
      end
    end
  end
end
