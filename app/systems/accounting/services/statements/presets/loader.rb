module Accounting
  module Statements
    module Presets
      # Loads the system statement presets (app/systems/accounting/presets/**/*.yml)
      # into system reports. Idempotent: a preset's report is found by key and
      # its layout rebuilt, since system presets are owned by the code.
      # Organization copies are separate reports and are left alone.
      #
      # Preset format: see presets/ifrs/balance_sheet.yml. Lines default to
      # kind "mapped" and to their parent's normal side (else debit).
      class Loader
        ROOT = Rails.root.join("app/systems/accounting/presets")

        def self.call(paths: Dir[ROOT.join("**/*.yml")].sort)
          paths.map { |path| new(YAML.load_file(path)).call }
        end

        def initialize(definition)
          @definition = definition.deep_stringify_keys
        end

        def call
          ActiveRecord::Base.transaction do
            report = Reporting::Report.system.find_or_initialize_by(key: definition.fetch("key"))
            report.assign_attributes(
              report_type: definition.fetch("report_type", "accounting.statement"),
              category: definition.fetch("category"),
              standard: definition["standard"],
              statement_type: definition["statement_type"],
              settings: definition.fetch("report_settings", {})
            )
            report.write_attribute(:name, definition.fetch("name"))
            report.write_attribute(:description, definition.fetch("description", {}))
            report.save!
            build_layout(report) if definition.key?("lines")
            report
          end
        end

        private

        attr_reader :definition

        def build_layout(report)
          layout = report.statement_layout || report.build_statement_layout
          layout.settings = definition.fetch("settings", {})
          layout.save!
          # System presets are owned by the code: rebuilt without versions.
          Accounting::StatementMappingRule.where(statement_layout_id: layout.id).delete_all
          Accounting::StatementLine.where(statement_layout_id: layout.id).delete_all

          @lines = {}
          @position = 0
          Array(definition["lines"]).each { |line| create_line(layout, line, nil) }
          Array(definition["rules"]).each_with_index { |rule, index| create_rule(layout, rule, index) }
          layout.reload
        end

        def create_line(layout, data, parent)
          line = layout.lines.new(
            key: data.fetch("key"),
            parent: parent,
            position: (@position += 1),
            kind: data.fetch("kind", "mapped"),
            normal_side: data["normal_side"] || parent&.normal_side || "debit",
            formula: data["formula"],
            style: data.fetch("style", {}),
            metadata: data.fetch("metadata", {})
          )
          line.write_attribute(:label, data.fetch("label"))
          line.save!
          @lines[line.key] = line
          Array(data["children"]).each { |child| create_line(layout, child, line) }
        end

        def create_rule(layout, data, index)
          layout.rules.create!(
            line: @lines.fetch(data.fetch("line")),
            opposite_line: data["opposite_line"] && @lines.fetch(data["opposite_line"]),
            selector_type: data.fetch("selector_type"),
            selector: data.fetch("selector"),
            grain: data.fetch("grain", "account"),
            measure: data.fetch("measure", "balance"),
            priority: data["priority"],
            position: index + 1,
            note: data["note"]
          )
        end
      end
    end
  end
end
