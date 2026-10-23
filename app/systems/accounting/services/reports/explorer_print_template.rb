# app/systems/accounting/services/reports/explorer_print_template.rb
module Accounting
  module Reports
    # Base of the system print templates of the explorer pages (Ariana
    # Reports JSON): a header with the organization, the title, the period,
    # entry types and states; the drill filters, one line each; a table of
    # lines with totals; printed date and page numbers in the footer.
    #
    # Subclasses define the page, the header fields and the columns. Amounts
    # use the decimals of the main currency, so templates are generated per
    # organization (see ReportTemplate::GENERATED_SYSTEM_TEMPLATES).
    class ExplorerPrintTemplate
      include TemplateSupport

      ROW_HEIGHT = 6
      HEADER_ROW_HEIGHT = 5
      COLUMN_HEADER_HEIGHT = 7
      FIELD_LABEL_WIDTH = 28
      DATE_FORMAT = { "type" => "date", "pattern" => "yyyy/MM/dd" }.freeze

      # main_digits: decimals of the main currency (the amounts' currency).
      def self.build(main_digits: 2, locale: "en")
        new(main_digits, locale).build
      end

      def self.for(organization, locale: "en")
        build(main_digits: organization&.accounting_setting&.main_currency&.decimal_digits || 2, locale: locale)
      end

      def initialize(main_digits, locale = "en")
        @amount = { "type" => "number", "decimals" => main_digits.to_i.clamp(0, 8) }.freeze
        @locale = locale.to_s.presence || "en"
      end

      def build
        template = {
          "schemaVersion" => 1,
          "name" => label("title"),
          "description" => label("description"),
          "unit" => "mm",
          "locale" => format_locale,
          "page" => { "size" => "A4", "orientation" => orientation,
                      "margins" => { "top" => 10, "right" => 10, "bottom" => 10, "left" => 10 } },
          "dataSources" => data_sources,
          "styles" => styles,
          "pageHeader" => { "id" => "report_header", "height" => page_header_height, "components" => page_header },
          "pageFooter" => { "id" => "report_footer", "height" => 6, "components" => page_footer },
          "body" => [ filters_region, spacer, lines_region ]
        }
        rtl? ? mirror(template, width) : template
      end

      private

      attr_reader :amount

      # Subclass interface ---------------------------------------------------

      # "portrait" or "landscape".
      def orientation
        raise NotImplementedError
      end

      # Printable width in mm (page width minus margins).
      def width
        orientation == "landscape" ? 277.0 : 190.0
      end

      # [id, label, value] laid out two per row under the title.
      def header_fields
        [ [ "period", shared_label("period"), period_value ], [ "states", shared_label("states"), "{{ summary[0].states_text }}" ] ]
      end

      # [{ id:, title:, width:, value:, align:, format:, grow: }], widths in mm summing to #width.
      def columns
        raise NotImplementedError
      end

      # { column id => total expression } for contiguous columns.
      def totals
        raise NotImplementedError
      end

      def sort
        []
      end

      # Fields of the report (root) and line data sources besides the shared ones.
      def report_fields
        []
      end

      def line_fields
        raise NotImplementedError
      end

      # ----------------------------------------------------------------------

      def period_value
        "{{ summary[0].from }} #{shared_label('period_to')} {{ summary[0].to }}"
      end

      def page_header_height
        20 + header_field_rows * HEADER_ROW_HEIGHT + HEADER_ROW_HEIGHT + 1
      end

      def header_field_rows
        (header_fields.size / 2.0).ceil
      end

      def page_header
        half = (width / 2).round(2)
        components = [
          text("org_name", 0, 0, width, 8, "{{ summary[0].organization_name }}", nil,
               style: { "fontFamily" => font, "fontSize" => 15, "fontWeight" => "bold", "textAlign" => "center", "verticalAlign" => "middle" }),
          text("title", 0, 8, width, 7, label("title"), nil,
               style: { "fontFamily" => font, "fontSize" => 12, "fontWeight" => "bold", "color" => "#666666",
                        "textAlign" => "center", "verticalAlign" => "middle" })
        ]
        header_fields.each_with_index do |(id, title, value), index|
          x = index.even? ? 0 : half
          y = 18 + (index / 2) * HEADER_ROW_HEIGHT
          components << text("#{id}_label", x, y, FIELD_LABEL_WIDTH, HEADER_ROW_HEIGHT, title, "label")
          value_component = text("#{id}_value", x + FIELD_LABEL_WIDTH, y, (half - FIELD_LABEL_WIDTH).round(2),
                                 HEADER_ROW_HEIGHT, value, "value")
          value_component["format"] = DATE_FORMAT if id == "period"
          components << value_component
        end
        y = 18 + header_field_rows * HEADER_ROW_HEIGHT
        components << text("entry_types_label", 0, y, FIELD_LABEL_WIDTH, HEADER_ROW_HEIGHT, shared_label("entry_types"), "label")
        components << text("entry_types_value", FIELD_LABEL_WIDTH, y, width - FIELD_LABEL_WIDTH, HEADER_ROW_HEIGHT,
                           "{{ summary[0].entry_types_text }}", "value")
        components
      end

      def page_footer
        half = (width / 2).round(2)
        [
          text("printed_at", 0, 0, half, 5, shared_label("printed_at", date: "{{ formatDate(now(), 'yyyy/MM/dd HH:mm') }}"), "muted"),
          text("page_of", half, 0, half, 5, shared_label("page_of", number: "{{ page.number }}", count: "{{ page.count }}"), "muted",
               style: { "textAlign" => "right" })
        ]
      end

      # The drill filters, e.g. "Account: 1101 Bank, 1102 Cash".
      def filters_region
        {
          "kind" => "dataRegion",
          "id" => "filters",
          "dataSource" => "filters",
          "detail" => { "id" => "filter", "height" => HEADER_ROW_HEIGHT, "components" => [
            text("filter_dimension", 0, 0, FIELD_LABEL_WIDTH, HEADER_ROW_HEIGHT, "{{ row.dimension_name }}:", "label"),
            text("filter_items", FIELD_LABEL_WIDTH, 0, width - FIELD_LABEL_WIDTH, HEADER_ROW_HEIGHT, "{{ row.items_text }}", "value",
                 canGrow: true)
          ] }
        }
      end

      def spacer
        { "kind" => "band", "id" => "spacer", "height" => 2, "components" => [] }
      end

      def lines_region
        {
          "kind" => "dataRegion",
          "id" => "lines",
          "dataSource" => "lines",
          "sort" => sort,
          "repeatHeaderOnEachPage" => true,
          "header" => { "id" => "columns", "height" => COLUMN_HEADER_HEIGHT, "components" => column_header },
          "detail" => { "id" => "line", "height" => ROW_HEIGHT, "components" => detail },
          "footer" => { "id" => "totals", "height" => ROW_HEIGHT, "components" => totals_band }
        }
      end

      # Column x positions and widths in mm.
      def layout
        @layout ||= begin
          x = 0.0
          columns.to_h do |column|
            position = [ x.round(2), column[:width].to_f.round(2) ]
            x += column[:width]
            [ column[:id], position ]
          end
        end
      end

      def column_header
        columns.map do |column|
          x, column_width = layout.fetch(column[:id])
          text("th_#{column[:id]}", x, 0, column_width, COLUMN_HEADER_HEIGHT, column[:title], "th")
        end
      end

      def detail
        columns.map do |column|
          x, column_width = layout.fetch(column[:id])
          # growToHeight keeps the bordered cells of a row the same height.
          component = text("td_#{column[:id]}", x, 0, column_width, ROW_HEIGHT, column[:value], "cell",
                           style: { "textAlign" => column[:align] || "left" }, growToHeight: true)
          component["canGrow"] = true if column[:grow]
          component["format"] = column[:format] if column[:format]
          component
        end
      end

      # "Total" over the columns before the totals, the totals, and an empty
      # cell over the columns after them.
      def totals_band
        ids = columns.map { |column| column[:id] }
        first = ids.index(totals.keys.first)
        last = ids.index(totals.keys.last)
        label_width = ids.first(first).sum { |id| layout.fetch(id).last }.round(2)
        components = [ text("total_label", 0, 0, label_width, ROW_HEIGHT, shared_label("total"), "sum") ]
        totals.each do |id, expression|
          x, column_width = layout.fetch(id)
          components << text("total_#{id}", x, 0, column_width, ROW_HEIGHT, expression, "sum", format: amount)
        end
        rest = ids.drop(last + 1)
        if rest.any?
          x = layout.fetch(rest.first).first
          components << text("total_rest", x, 0, (width - x).round(2), ROW_HEIGHT, "", "sum")
        end
        components
      end

      def cell_style(**extra)
        { "fontSize" => 8, "verticalAlign" => "middle", "padding" => 1, "border" => BORDER, "fontFamily" => font,
          **extra.transform_keys(&:to_s) }
      end

      def styles
        {
          "th" => cell_style(fontWeight: "bold", backgroundColor: "#d9d9d9", textAlign: "center"),
          "cell" => cell_style,
          "sum" => cell_style(fontWeight: "bold", backgroundColor: "#f2f2f2", textAlign: "right"),
          "label" => { "fontSize" => 9, "fontWeight" => "bold", "verticalAlign" => "middle", "fontFamily" => font },
          "value" => { "fontSize" => 9, "verticalAlign" => "middle", "fontFamily" => font },
          "muted" => { "fontSize" => 8, "color" => "#555555", "verticalAlign" => "middle", "fontFamily" => font }
        }
      end

      def field(name, type = "string")
        { "name" => name, "type" => type }
      end

      def data_sources
        [
          { "name" => "summary", "path" => "root", "fields" => [
            field("organization_name"), field("from", "date"), field("to", "date"),
            field("entry_types_text"), field("states_text"), field("approved_only", "boolean"),
            *report_fields,
            { "name" => "currency", "type" => "object", "fields" => [
              field("abr"), field("name"), field("names", "object"), field("decimal_digits", "number")
            ] }
          ] },
          { "name" => "filters", "path" => "root.filters", "fields" => [
            field("dimension"), field("dimension_name"), field("items_text")
          ] },
          { "name" => "lines", "path" => line_path, "fields" => line_fields }
        ]
      end
    end
  end
end
