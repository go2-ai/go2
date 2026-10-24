# frozen_string_literal: true

module Accounting
  module StatementMappingAi
    # Processes a message of the statement mapping assistant (see
    # Ai::ProcessMessageJob for the lifecycle).
    class ProcessMessageJob < Ai::ProcessMessageJob
      private

      def service_class
        Accounting::StatementMappingAi::Service
      end
    end
  end
end
