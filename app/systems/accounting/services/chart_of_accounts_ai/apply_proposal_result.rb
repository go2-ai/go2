# frozen_string_literal: true

module Accounting
  module ChartOfAccountsAi
    # Return value of Accounting::ChartOfAccountsAi::ApplyProposal#call.
    #
    # Fields:
    #   success  — true if the proposal was persisted, false otherwise.
    #   errors   — array of hashes { path:, field:, message: } when
    #              success is false; empty array when success is true.
    #   chat     — the reloaded chat (with status "accepted" on success).
    #   chart    — the persisted tree, or nil on failure. Same shape as
    #              the existing /accounting/chart_of_accounts endpoint
    #              returns.
    class ApplyProposalResult
      attr_reader :errors, :chat, :chart

      def initialize(success:, chat:, errors: [], chart: nil)
        @success = success
        @chat    = chat
        @errors  = Array(errors)
        @chart   = chart
      end

      def success?
        @success
      end
    end
  end
end
