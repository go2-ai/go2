module Accounting
  module Reports
    # Base of the portrait report prints with a current column and an
    # optional comparison (financial statements, ratios): the period is a
    # text, there are no entry type fields and no totals band. Columns
    # whose id is in comparison_ids show only when summary[0].comparison.
    class ComparisonPrintTemplate < ExplorerPrintTemplate
      private

      def orientation
        "portrait"
      end

      def comparison_ids
        %w[previous]
      end

      def page_header
        components = super
        # No period field type conversion: the period is a text.
        components.each { |component| component.delete("format") if component["id"] == "period_value" }
        components.reject { |component| component["id"].start_with?("entry_types") }
      end

      def page_header_height
        20 + header_field_rows * HEADER_ROW_HEIGHT + 1
      end

      def column_header
        hide_comparison(super)
      end

      def detail
        hide_comparison(super)
      end

      def hide_comparison(components)
        components.each do |component|
          component["visible"] = "summary[0].comparison" if comparison_ids.any? { |id| component["id"].end_with?("_#{id}") }
        end
      end

      # No totals row.
      def lines_region
        region = super
        region.delete("footer")
        region
      end

      def totals
        {}
      end

      def totals_band
        []
      end

      def line_path
        "root.rows"
      end
    end
  end
end
