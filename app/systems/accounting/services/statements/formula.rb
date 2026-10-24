require "dentaku"

module Accounting
  module Statements
    # Arithmetic formulas of statement lines and ratios, evaluated with
    # Dentaku (no eval). Variables are line keys, or "<statement>.<key>"
    # for ratios; values are BigDecimal.
    #
    #   Formula.evaluate("revenue + cost_of_sales", { "revenue" => 10, "cost_of_sales" => -4 })
    module Formula
      class Error < StandardError; end

      module_function

      def calculator
        Dentaku::Calculator.new(case_sensitive: false)
      end

      # nil when valid, otherwise the parser's message.
      def syntax_error(source)
        calculator.ast(source.to_s)
        nil
      rescue Dentaku::Error, Dentaku::ParseError, Dentaku::TokenizerError => e
        e.message.presence || e.class.name
      end

      def dependencies(source)
        calculator.dependencies(source.to_s).map(&:to_s).map(&:downcase).uniq
      rescue Dentaku::Error, Dentaku::ParseError, Dentaku::TokenizerError
        []
      end

      # Raises Formula::Error (division by zero, unknown variable, ...).
      def evaluate(source, variables)
        value = calculator.evaluate!(source.to_s, nest(variables))
        value.is_a?(Numeric) ? BigDecimal(value.to_s) : raise(Error, "not a number")
      rescue Dentaku::ZeroDivisionError
        raise Error, "division by zero"
      rescue Dentaku::Error, Dentaku::ParseError, Dentaku::TokenizerError, Dentaku::UnboundVariableError => e
        raise Error, e.message
      end

      # "bs.total_assets" => 1 becomes { "bs" => { "total_assets" => 1 } }.
      def nest(variables)
        variables.each_with_object({}) do |(name, value), nested|
          parts = name.to_s.downcase.split(".")
          target = parts[0...-1].reduce(nested) { |hash, part| hash[part] ||= {} }
          target[parts.last] = value
        end
      end
    end
  end
end
