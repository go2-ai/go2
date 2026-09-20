# frozen_string_literal: true

module Accounting
  module ChartOfAccountsAi
    # Chart-of-accounts AI message processor.
    #
    # All of the async lifecycle (start/finish processing, attachment
    # extraction, service invocation, error fallback) lives in
    # Ai::ProcessMessageJob. This subclass declares only the two
    # feature-specific facts:
    #
    #   - which service runs the turn
    #   - what to show the user if the job fails unexpectedly
    #
    # The concurrency key is inherited as-is (one job per chat at a time).
    class ProcessMessageJob < Ai::ProcessMessageJob
      private

      def service_class
        Accounting::ChartOfAccountsAi::Service
      end

      def fallback_message
        "I couldn't complete this request — please try again."
      end
    end
  end
end