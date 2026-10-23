# app/systems/accounting/services/reports/journal_entry_items_template.rb
module Accounting
  module Reports
    # The system print template of the journal entry items page (A4
    # landscape): the items of the explorer's period and filters, oldest
    # first, with debit and credit totals. Labels come from
    # reports.journal_entry_items in config/locales. The data also has each
    # item's centers (`centers`) for organizations that add them.
    class JournalEntryItemsTemplate < ExplorerPrintTemplate
      REPORT_KEY = "journal_entry_items".freeze

      # Currency amounts and rates keep their own decimals.
      PLAIN_NUMBER = { "type" => "number" }.freeze

      private

      def label_scope
        "journal_entry_items"
      end

      def orientation
        "landscape"
      end

      def columns
        [
          { id: "date", title: label("date"), width: 20, value: "{{ row.date }}", align: "center",
            format: DATE_FORMAT },
          { id: "no", title: label("no"), width: 14, value: "{{ row.no }}", align: "center" },
          { id: "ref", title: label("ref"), width: 14, value: "{{ row.ref }}", align: "center" },
          { id: "row", title: label("row"), width: 10, value: "{{ row.row }}", align: "center" },
          { id: "account", title: label("account"), width: 58, value: "{{ row.account_code }} - {{ row.account_name }}",
            grow: true },
          { id: "description", title: label("description"), width: 63, value: "{{ row.description }}", grow: true },
          { id: "debit", title: label("debit"), width: 24, value: "{{ row.debit ? row.debit : '' }}", align: "right",
            format: amount },
          { id: "credit", title: label("credit"), width: 24, value: "{{ row.credit ? row.credit : '' }}", align: "right",
            format: amount },
          { id: "currency", title: label("currency"), width: 12, value: "{{ row.currency }}", align: "center" },
          { id: "currency_amount", title: label("currency_amount"), width: 22, value: "{{ row.currency_amount }}",
            align: "right", format: PLAIN_NUMBER },
          { id: "rate", title: label("rate"), width: 16, value: "{{ row.rate }}", align: "right", format: PLAIN_NUMBER }
        ]
      end

      def totals
        { "debit" => "{{ summary[0].total_debit }}", "credit" => "{{ summary[0].total_credit }}" }
      end

      def sort
        [ { "expression" => "row.date", "direction" => "asc" },
          { "expression" => "row.no", "direction" => "asc" },
          { "expression" => "row.row", "direction" => "asc" } ]
      end

      def report_fields
        [ field("total_debit", "number"), field("total_credit", "number") ]
      end

      def line_path
        "root.items"
      end

      def line_fields
        [
          field("date", "date"), field("no"), field("ref"), field("row", "number"),
          field("account_code"), field("account_name"), field("centers"), field("description"),
          field("debit", "number"), field("credit", "number"), field("currency"),
          field("currency_amount", "number"), field("rate", "number")
        ]
      end
    end
  end
end
