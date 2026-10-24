module Accounting
  module Reports
    # Run params shared by the accounting report types. Values that aren't
    # plain strings (e.g. `from[]=...`) count as invalid, so a malformed
    # request gets a 422 instead of an error deep in a runner.
    module RunParams
      # Dates outside this range are typos (and PostgreSQL can't store some).
      YEARS = 1900..2200

      module_function

      # nil when blank; Date::Error when invalid or out of range.
      def date(params, key)
        value = params[key]
        return nil if value.blank?
        return value if value.is_a?(Date)
        raise Date::Error, "invalid date" unless value.is_a?(String)

        date = Date.iso8601(value)
        raise Date::Error, "date out of range" unless YEARS.cover?(date.year)

        date
      end

      def boolean(params, key, default: false)
        return default unless params.key?(key) && scalar?(params[key])

        cast = ActiveModel::Type::Boolean.new.cast(params[key])
        cast.nil? ? default : cast
      end

      def approved_only?(params)
        boolean(params, :approved_only)
      end

      # Comparison columns are on unless asked to leave them out.
      def comparison?(params)
        boolean(params, :comparison, default: true)
      end

      # nil when blank or not a number.
      def integer(params, key)
        value = params[key]
        return nil unless scalar?(value) && value.to_s.match?(/\A\d+\z/)

        value.to_i
      end

      def string(params, key)
        value = params[key]
        scalar?(value) ? value.to_s.presence : nil
      end

      def scalar?(value)
        value.is_a?(String) || value.is_a?(Numeric) || value == true || value == false
      end
    end
  end
end
