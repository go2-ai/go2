module Accounting
  module Statements
    # Report type "accounting.statement": a statement layout with its lines
    # and mapping rules.
    module ReportType
      module_function
      # params: date (balance sheet), from/to (period statements),
      # comparison ("false" to leave it out), approved_only.
      def run(report, organization:, params:, access: nil)
        Payload.new(runner(report, organization, params).call, organization: organization).run
      end

      # Data of the financial statement print (Reports::FinancialStatementTemplate).
      def print(report, organization:, params:, access: nil)
        payload = run(report, organization: organization, params: params, access: access)
        columns = payload[:columns]
        current, previous = columns.map { |column| column[:key] }
        number = ->(value) { value.nil? ? nil : value.to_f }
        rows = payload[:lines].reject { |line| line[:style]["hidden"] }.filter_map do |line|
          values = line[:values]
          next if line[:style]["hide_if_zero"] && values.values.all? { |v| v.to_f.zero? }

          heading = line[:kind] == "heading"
          {
            label: line[:label], indented_label: "#{"\u00A0" * (3 * line[:depth])}#{line[:label]}", depth: line[:depth],
            bold: heading || line[:style]["bold"] == true, heading: heading,
            current: number.call(values[current]), previous: previous && number.call(values[previous]),
            variance: previous && !heading ? (values[current].to_f - values[previous].to_f) : nil
          }
        end
        first = columns.first
        Accounting::Reports::PrintHeader.call(organization: organization, from: first[:from] || first[:as_of], to: first[:to] || first[:as_of],
                                              approved_only: Accounting::Reports::RunParams.approved_only?(params))
                                        .merge(report_name: report.name, comparison: previous.present?,
                                               period_text: Accounting::Reports::PrintHeader.column_title(first),
                                               title_current: Accounting::Reports::PrintHeader.column_title(first),
                                               title_previous: previous ? Accounting::Reports::PrintHeader.column_title(columns.last) : "",
                                               rows: rows)
      end

      # params: line (key), account_id, center_level
      def drill(report, organization:, params:, access: nil)
        result = runner(report, organization, params).call
        Payload.new(result, organization: organization).contributions(
          Accounting::Reports::RunParams.string(params, :line).to_s,
          account_id: Accounting::Reports::RunParams.integer(params, :account_id),
          center_level: Accounting::Reports::RunParams.integer(params, :center_level)&.clamp(1, 6)
        )
      end

      def runner(report, organization, params, rules: nil)
        Runner.new(report: report, organization: organization, columns: columns(report, organization, params),
                   approved_only: Accounting::Reports::RunParams.approved_only?(params), rules: rules)
      end

      def columns(report, organization, params)
        Runner.default_columns(
          report, organization: organization,
          date: Accounting::Reports::RunParams.date(params, :date), from: Accounting::Reports::RunParams.date(params, :from),
          to: Accounting::Reports::RunParams.date(params, :to),
          comparison: Accounting::Reports::RunParams.comparison?(params)
        )
      end

      # Copies the layout, lines and rules of `source` onto `copy`.
      # Line ids are remapped so the copy's rules point at its own lines.
      def copy_content(source, copy)
        layout = source.statement_layout
        return if layout.nil?

        new_layout = copy.create_statement_layout!(settings: layout.settings)
        line_ids = {}
        # Parents come before their children when ordered by depth.
        lines_by_depth(layout.lines.to_a).each do |line|
          attributes = line.attributes.except("id", "statement_layout_id", "parent_id", "label", "created_at", "updated_at")
          new_line = new_layout.lines.new(attributes.merge("parent_id" => line_ids[line.parent_id]))
          # The raw translations: the Mobility writer would store the hash
          # as the text of the current locale.
          new_line.write_attribute(:label, line.read_attribute(:label))
          new_line.save!
          line_ids[line.id] = new_line.id
        end
        layout.rules.each do |rule|
          attributes = rule.attributes.except("id", "statement_layout_id", "created_at", "updated_at")
          new_layout.rules.create!(attributes.merge(
            "statement_line_id" => line_ids.fetch(rule.statement_line_id),
            "opposite_line_id" => line_ids[rule.opposite_line_id]
          ))
        end
        new_layout
      end

      def lines_by_depth(lines)
        by_id = lines.index_by(&:id)
        depth = ->(line) { line.parent_id ? 1 + depth.call(by_id.fetch(line.parent_id)) : 0 }
        lines.sort_by { |line| [ depth.call(line), line.position, line.id ] }
      end
    end
  end
end
