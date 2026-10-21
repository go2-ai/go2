# app/systems/accounting/services/closing/error.rb
module Accounting
  module Closing
    # A closing step can't run. key identifies the reason (see
    # models.accounting/fiscal_year_closing.errors); details carry data for
    # the message and the UI.
    class Error < StandardError
      attr_reader :key, :details

      def initialize(key, **details)
        @key = key
        @details = details
        super(key.to_s)
      end
    end
  end
end
