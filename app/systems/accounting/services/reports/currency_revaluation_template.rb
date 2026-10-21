# app/systems/accounting/services/reports/currency_revaluation_template.rb
module Accounting
  module Reports
    # The system print template of a revaluation (Ariana Reports JSON, A4
    # landscape). It is generated per organization, so it gets one code and
    # one name column per center level of the accounting settings. Column
    # titles are the ones of the revaluation page grid.
    #
    # Titles are English: the bundled PDF font (Roboto) has no Persian
    # glyphs. Organizations can copy the template and change it in the
    # designer.
    class CurrencyRevaluationTemplate
      REPORT_KEY = "currency_revaluation".freeze
      WIDTH = 277.0 # A4 landscape (297 mm) minus 10 mm margins
      FONT = "Roboto".freeze
      BORDER = { "width" => 0.5, "color" => "#000000", "style" => "solid" }.freeze
      GROUP_HEIGHT = 5
      SUB_HEIGHT = 5
      ROW_HEIGHT = 6

      # main_digits: decimals of the main currency (base amounts and totals).
      def self.build(center_levels: 3, main_digits: 2)
        new(center_levels, main_digits).build
      end

      def self.for(organization)
        setting = organization&.accounting_setting
        build(center_levels: setting&.center_levels || 3, main_digits: setting&.main_currency&.decimal_digits || 2)
      end

      def initialize(center_levels, main_digits)
        @center_levels = center_levels.to_i.clamp(0, 6)
        @amount = { "type" => "number", "decimals" => main_digits.to_i.clamp(0, 8) }.freeze
      end

      def build
        {
          "schemaVersion" => 1,
          "name" => "Revaluation of Monetary Items",
          "description" => "Balances revalued to the exchange rates of the revaluation date, per account, " \
                           "centers and currency, with differences and gain/loss accounts.",
          "unit" => "mm",
          "locale" => "en-US",
          "page" => { "size" => "A4", "orientation" => "landscape",
                      "margins" => { "top" => 10, "right" => 10, "bottom" => 10, "left" => 10 } },
          "dataSources" => data_sources,
          "styles" => styles,
          "pageHeader" => { "id" => "revaluation_header", "height" => 36, "components" => page_header },
          "pageFooter" => { "id" => "revaluation_footer", "height" => 6, "components" => [
            text("page_of", 157, 0, 120, 5, "Page {{ page.number }} of {{ page.count }}", "muted", style: { "textAlign" => "right" })
          ] },
          "body" => [ {
            "kind" => "dataRegion",
            "id" => "lines",
            "dataSource" => "items",
            "sort" => [ { "expression" => "row.account_code", "direction" => "asc" },
                        *(1..center_levels).map { |level| { "expression" => "row.center_#{level}_code", "direction" => "asc" } } ],
            "repeatHeaderOnEachPage" => true,
            "header" => { "id" => "columns", "height" => GROUP_HEIGHT + SUB_HEIGHT, "components" => column_header },
            "detail" => { "id" => "line", "height" => ROW_HEIGHT, "components" => detail },
            "footer" => { "id" => "totals", "height" => 18, "components" => totals }
          } ]
        }
      end

      private

      attr_reader :center_levels, :amount

      # Groups of columns: a title over one column, or over Code / Name.
      # Widths are relative and scaled to the page width.
      def groups
        @groups ||= begin
          list = [ { id: "account", title: "Account", parts: [
            { id: "account_code", title: "Code", width: 14, text: "{{ row.account_code }}" },
            { id: "account_name", title: "Name", width: 32, text: "{{ row.account_name }}" }
          ] } ]
          (1..center_levels).each do |level|
            list << { id: "center_#{level}", title: "Center #{level}", parts: [
              { id: "center_#{level}_code", title: "Code", width: 11, text: "{{ row.center_#{level}_code }}" },
              { id: "center_#{level}_name", title: "Name", width: 19, text: "{{ row.center_#{level}_name }}" }
            ] }
          end
          list + [
            single("currency", "Currency", 11, "{{ row.currency }}", "center"),
            single("currency_balance", "Balance in foreign currency", 21, "{{ row.currency_balance_text }}", "right"),
            single("book_balance", "Balance in {{ revaluation[0].currency.abr }}", 21, "{{ row.book_base_balance }}", "right", amount),
            single("rate", "Rate", 17, "{{ row.rate }}", "right"),
            single("revalued", "Revalued balance", 21, "{{ row.revalued_base_balance }}", "right", amount),
            single("difference", "Difference", 20, "{{ row.difference }}", "right", amount),
            single("gain_loss", "Gain/loss account", 30, "{{ row.gain_loss_account_code }} {{ row.gain_loss_account_name }}"),
            single("note", "Note", 18, "{{ row.note }}")
          ]
        end
      end

      def single(id, title, width, value, align = "left", format = nil)
        { id: id, title: title, parts: [ { id: id, width: width, text: value, align: align, format: format } ] }
      end

      # Column x positions and widths in mm, scaled to the page width.
      def layout
        @layout ||= begin
          parts = groups.flat_map { |group| group[:parts] }
          scale = WIDTH / parts.sum { |part| part[:width] }
          x = 0.0
          parts.each_with_index.to_h do |part, index|
            width = index == parts.size - 1 ? (WIDTH - x).round(2) : (part[:width] * scale).round(2)
            position = [ x.round(2), width ]
            x += width
            [ part[:id], position ]
          end
        end
      end

      def font_size
        center_levels > 3 ? 6 : 7
      end

      def column_header
        groups.flat_map do |group|
          parts = group[:parts]
          if parts.size == 1
            x, width = layout.fetch(parts.first[:id])
            [ text("th_#{group[:id]}", x, 0, width, GROUP_HEIGHT + SUB_HEIGHT, group[:title], "th") ]
          else
            first_x, = layout.fetch(parts.first[:id])
            group_width = parts.sum { |part| layout.fetch(part[:id]).last }.round(2)
            [ text("th_#{group[:id]}", first_x, 0, group_width, GROUP_HEIGHT, group[:title], "th") ] +
              parts.map do |part|
                x, width = layout.fetch(part[:id])
                text("th_#{part[:id]}", x, GROUP_HEIGHT, width, SUB_HEIGHT, part[:title], "th")
              end
          end
        end
      end

      def detail
        groups.flat_map { |group| group[:parts] }.map do |part|
          x, width = layout.fetch(part[:id])
          # canGrow: "Grow to fit text" (long names wrap); growToHeight keeps
          # the bordered cells of a row the same height.
          component = text("td_#{part[:id]}", x, 0, width, ROW_HEIGHT, part[:text], "cell",
                           style: { "textAlign" => part[:align] || "left" }, canGrow: true, growToHeight: true)
          component["format"] = part[:format] if part[:format]
          if part[:id] == "difference"
            component["conditions"] = [
              { "expression" => "row.difference > 0", "style" => { "color" => "#1b5e20" } },
              { "expression" => "row.difference < 0", "style" => { "color" => "#b71c1c" } }
            ]
          end
          component
        end
      end

      # Gain, loss and net under the difference column.
      def totals
        x, width = layout.fetch("difference")
        rest = (WIDTH - x - width).round(2)
        [ [ "gain", "Total gain", "{{ revaluation[0].total_gain }}" ],
          [ "loss", "Total loss", "{{ revaluation[0].total_loss }}" ],
          [ "net", "Total difference (posted)", "{{ sum(rows, 'posted_difference') }}" ] ].each_with_index.flat_map do |(id, label, value), index|
          y = index * ROW_HEIGHT
          [ text("total_#{id}_label", 0, y, x, ROW_HEIGHT, label, "sum"),
            text("total_#{id}", x, y, width, ROW_HEIGHT, value, "sum", format: amount),
            text("total_#{id}_rest", x + width, y, rest, ROW_HEIGHT, "", "sum") ]
        end
      end

      def page_header
        components = [
          text("org_name", 0, 0, WIDTH, 9, "{{ revaluation[0].organization_name }}", nil,
               style: { "fontFamily" => FONT, "fontSize" => 16, "fontWeight" => "bold", "textAlign" => "center", "verticalAlign" => "middle" }),
          text("title", 0, 9, WIDTH, 7, "Revaluation of Monetary Items", nil,
               style: { "fontFamily" => FONT, "fontSize" => 13, "fontWeight" => "bold", "color" => "#666666",
                        "textAlign" => "center", "verticalAlign" => "middle" })
        ]
        left = [ [ "date", "Revaluation date:", "{{ revaluation[0].as_of_date }}" ],
                 [ "kind", "Kind:", "{{ revaluation[0].kind_name }}" ],
                 [ "status", "Status:", "{{ revaluation[0].status_name }}" ] ]
        right = [ [ "entry", "Journal entry:", "{{ revaluation[0].journal_entry_no }}" ],
                  [ "posted", "Posted:", "{{ revaluation[0].posted_at }} {{ revaluation[0].posted_by }}" ],
                  [ "currency", "Main currency:", "{{ revaluation[0].currency.abr }}" ] ]
        left.each_with_index do |(id, label, value), index|
          y = 19 + index * 5
          components << text("#{id}_label", 0, y, 32, 5, label, "label")
          components << text("#{id}_value", 32, y, 80, 5, value, "value")
        end
        right.each_with_index do |(id, label, value), index|
          y = 19 + index * 5
          components << text("#{id}_label", 170, y, 30, 5, label, "label")
          components << text("#{id}_value", 200, y, 77, 5, value, "value")
        end
        components
      end

      def text(id, x, y, width, height, value, style_name, style: nil, **extra)
        component = { "id" => id, "type" => "text", "x" => x, "y" => y, "width" => width, "height" => height }
        component["styleName"] = style_name if style_name
        component["style"] = style if style
        extra.each { |key, val| component[key.to_s] = val }
        component["text"] = value
        component
      end

      def cell_style(**extra)
        { "fontSize" => font_size, "verticalAlign" => "middle", "padding" => 1, "border" => BORDER, "fontFamily" => FONT,
          **extra.transform_keys(&:to_s) }
      end

      def styles
        {
          "th" => cell_style(fontWeight: "bold", backgroundColor: "#d9d9d9", textAlign: "center"),
          "cell" => cell_style,
          "sum" => cell_style(fontWeight: "bold", backgroundColor: "#f2f2f2", textAlign: "right"),
          "label" => { "fontSize" => 9, "fontWeight" => "bold", "verticalAlign" => "middle", "fontFamily" => FONT },
          "value" => { "fontSize" => 9, "verticalAlign" => "middle", "fontFamily" => FONT },
          "muted" => { "fontSize" => 8, "color" => "#555555", "verticalAlign" => "middle", "fontFamily" => FONT }
        }
      end

      def data_sources
        [
          { "name" => "revaluation", "path" => "root", "fields" => [
            *%w[id total_difference total_gain total_loss].map { |name| { "name" => name, "type" => "number" } },
            { "name" => "as_of_date", "type" => "date" },
            *%w[kind kind_name status status_name description journal_entry_no organization_name created_by
                posted_by posted_at].map { |name| { "name" => name, "type" => "string" } },
            { "name" => "currency", "type" => "object", "fields" => [
              { "name" => "abr", "type" => "string" }, { "name" => "name", "type" => "string" },
              { "name" => "names", "type" => "object" }, { "name" => "decimal_digits", "type" => "number" }
            ] }
          ] },
          { "name" => "items", "path" => "root.items", "fields" => [
            *(%w[account_code account_name centers currency gain_loss_account_code gain_loss_account_name note] +
              (1..6).flat_map { |level| [ "center_#{level}_code", "center_#{level}_name" ] } + [ "currency_balance_text" ])
              .map { |name| { "name" => name, "type" => "string" } },
            *%w[currency_decimal_digits currency_balance book_base_balance rate revalued_base_balance
                difference posted_difference].map { |name| { "name" => name, "type" => "number" } },
            { "name" => "rate_date", "type" => "date" },
            { "name" => "excluded", "type" => "boolean" }
          ] }
        ]
      end
    end
  end
end
