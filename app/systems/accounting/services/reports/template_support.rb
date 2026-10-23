# app/systems/accounting/services/reports/template_support.rb
module Accounting
  module Reports
    # Shared helpers of the generated system print templates (Ariana Reports
    # JSON). A generator is built in one locale: labels come from
    # config/locales (reports.<scope>), and right-to-left locales (e.g. fa)
    # get a mirrored layout and a font with Arabic-script glyphs.
    #
    # Includers set @locale and implement #label_scope.
    module TemplateSupport
      LATIN_FONT = "Roboto".freeze
      # Yekan (the app's Persian UI font); Vazirmatn draws the characters Yekan lacks.
      RTL_FONT = "Yekan, Vazirmatn".freeze
      # Number and date formatting of the report (BCP 47).
      FORMAT_LOCALES = { "en" => "en-US", "fa" => "fa-IR" }.freeze
      BORDER = { "width" => 0.5, "color" => "#000000", "style" => "solid" }.freeze

      private

      attr_reader :locale

      def rtl?
        Rails.application.config.supported_locales.dig(locale, :rtl) == true
      end

      def font
        rtl? ? RTL_FONT : LATIN_FONT
      end

      def format_locale
        FORMAT_LOCALES.fetch(locale, locale)
      end

      # A label in the template's locale (English for locales without
      # translations). Keys under reports.shared are used by every report.
      def label(key, **options)
        I18n.t("reports.#{label_scope}.#{key}", locale: translation_locale, **options)
      end

      def shared_label(key, **options)
        I18n.t("reports.shared.#{key}", locale: translation_locale, **options)
      end

      def translation_locale
        I18n.available_locales.map(&:to_s).include?(locale) ? locale : I18n.default_locale
      end

      def text(id, x, y, width, height, value, style_name, style: nil, **extra)
        component = { "id" => id, "type" => "text", "x" => x, "y" => y, "width" => width, "height" => height }
        component["styleName"] = style_name if style_name
        component["style"] = style if style
        extra.each { |key, val| component[key.to_s] = val }
        component["text"] = value
        component
      end

      # Right-to-left version of a left-to-right layout: every component is
      # mirrored on the page width, alignments swap sides, and all text is
      # laid out right to left (which also starts unaligned text on the right).
      def mirror(template, width)
        template["styles"] = template["styles"].transform_values { |style| rtl_style(style) }
        bands = [ template["pageHeader"], template["pageFooter"] ] +
                template["body"].flat_map do |item|
                  item["kind"] == "dataRegion" ? [ item["header"], item["detail"], item["footer"] ] : [ item ]
                end
        bands.compact.each do |band|
          band["components"].each do |component|
            component["x"] = (width - component["x"] - component["width"]).round(2)
            component["style"] = flip_align(component["style"]) if component["style"]
          end
        end
        template
      end

      def rtl_style(style)
        style = flip_align(style)
        style["textAlign"] ||= "right"
        style.merge("direction" => "rtl")
      end

      def flip_align(style)
        swapped = { "left" => "right", "right" => "left" }
        style.merge("textAlign" => swapped.fetch(style["textAlign"], style["textAlign"])).compact
      end
    end
  end
end
