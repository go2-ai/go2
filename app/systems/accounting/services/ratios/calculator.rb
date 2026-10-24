module Accounting
  module Ratios
    # Computes the ratio catalog (ratios/catalog.yml) for a period and its
    # comparison, from the organization's primary statement of financial
    # position and statement of profit or loss (the IFRS presets when it
    # has none). A ratio needs view access to both statements; a missing
    # line or a zero divisor makes it "n/a" with a reason.
    class Calculator
      CATALOG = Rails.root.join("app/systems/accounting/services/ratios/catalog.yml")
      SOURCES = { "bs" => "balance_sheet", "pl" => "income_statement" }.freeze
      PRESETS = { "balance_sheet" => "ifrs.balance_sheet", "income_statement" => "ifrs.income_statement" }.freeze

      Column = Struct.new(:key, :from, :to, keyword_init: true)

      # Read once (the file ships with the code).
      def self.catalog
        @catalog ||= YAML.load_file(CATALOG).fetch("ratios").each(&:freeze).freeze
      end

      def initialize(organization:, access:, from:, to:, comparison: true, approved_only: false)
        @organization = organization
        @access = access
        @approved_only = approved_only
        @columns = [ Column.new(key: "current", from: from, to: to) ]
        previous = Column.new(key: "previous", from: from.prev_year, to: to.prev_year)
        @columns << previous if comparison && within_fiscal_years?(previous)
      end

      def call
        values = columns.to_h { |column| [ column.key, variables_for(column) ] }
        {
          columns: columns.map { |c| { key: c.key, from: c.from.iso8601, to: c.to.iso8601 } },
          # Statements the user can't open are named only as "no access".
          sources: sources.transform_values do |report|
            next nil unless report
            next { id: nil, name: nil, accessible: false } unless access.can_view?(report)

            { id: report.id, name: report.name, accessible: true }
          end,
          ratios: self.class.catalog.map { |ratio| ratio_json(ratio, values) }
        }
      end

      private

      attr_reader :organization, :access, :approved_only, :columns

      def sources
        @sources ||= SOURCES.to_h do |prefix, statement_type|
          report = Reporting::Report.active.where(organization: organization, statement_type: statement_type, primary: true).first ||
                   Reporting::Report.system.find_by(key: PRESETS[statement_type])
          [ prefix, report ]
        end
      end

      def ratio_json(ratio, values)
        name = ratio["name"][I18n.locale.to_s] || ratio["name"]["en"]
        description = ratio["description"][I18n.locale.to_s] || ratio["description"]["en"]
        dependencies = Accounting::Statements::Formula.dependencies(ratio["formula"])
        result = { key: ratio["key"], group: ratio["group"], format: ratio["format"], formula: ratio["formula"],
                   name: name, description: description, values: {}, reasons: {}, components: {} }

        blocked = dependencies.map { |dep| dep.split(".").first }.uniq.filter_map do |prefix|
          next unless SOURCES.key?(prefix.delete_suffix("_open"))

          report = sources[prefix.delete_suffix("_open")]
          if report.nil? then "no_statement"
          elsif !access.can_view?(report) then "no_access"
          end
        end
        columns.each do |column|
          if blocked.any?
            result[:reasons][column.key] = blocked.first
            next
          end
          variables = values.fetch(column.key)
          missing = dependencies.reject { |dep| variables.key?(dep) }
          result[:components][column.key] = dependencies.to_h { |dep| [ dep, variables[dep]&.to_s("F") ] }
          if missing.any?
            result[:reasons][column.key] = "missing_line"
            result[:missing] = missing
            next
          end
          begin
            result[:values][column.key] = Accounting::Statements::Formula.evaluate(ratio["formula"], variables).round(6).to_s("F")
          rescue Accounting::Statements::Formula::Error
            result[:reasons][column.key] = "not_computable"
          end
        end
        result[:component_lines] = dependencies.to_h { |dep| [ dep, component_line(dep) ] }
        result
      end

      def component_line(dependency)
        prefix, key = dependency.split(".", 2)
        report = sources[prefix.delete_suffix("_open")]
        report = nil unless report && access.can_view?(report)
        line = report&.statement_layout&.lines&.find { |l| l.key == key }
        { report_id: report&.id, line_key: key, label: line&.label, opening: prefix.end_with?("_open") }
      end

      # { "bs.total_assets" => BigDecimal, "bs_open.…", "pl.…", "days" }
      def variables_for(column)
        variables = { "days" => BigDecimal((column.to - column.from).to_i + 1) }
        bs = sources["bs"]
        pl = sources["pl"]
        if bs && access.can_view?(bs)
          closing = run(bs, Accounting::Statements::Runner::Column.new(key: "closing", as_of: column.to))
          opening_date = column.from - 1
          opening = if opening_date >= first_start
            run(bs, Accounting::Statements::Runner::Column.new(key: "closing", as_of: opening_date))
          else
            closing
          end
          add(variables, "bs", closing)
          add(variables, "bs_open", opening)
        end
        if pl && access.can_view?(pl)
          add(variables, "pl", run(pl, Accounting::Statements::Runner::Column.new(key: "closing", from: column.from, to: column.to)))
        end
        variables
      end

      def run(report, column)
        Accounting::Statements::Runner.new(report: report, organization: organization, columns: [ column ],
                                           approved_only: approved_only).call.engine("closing").values
      end

      def add(variables, prefix, values)
        values.each { |key, value| variables["#{prefix}.#{key}"] = value unless value.nil? }
      end

      def first_start
        @first_start ||= Accounting::Statements::Periods.first_start(organization)
      end

      def within_fiscal_years?(column)
        Accounting::Statements::Periods.within_fiscal_years?(organization, column.from, column.to)
      end
    end
  end
end
