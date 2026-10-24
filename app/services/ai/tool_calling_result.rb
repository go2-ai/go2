# frozen_string_literal: true

module Ai
  # The value returned by an Ai::ToolCallingService turn. Tells the
  # controller what happened so it can build the HTTP response.
  #
  # Fields:
  #   status           — one of STATUSES (see the constants below).
  #   messages_created — the AiMessage records created during this call,
  #                      in order.
  #   proposal         — the last proposal produced this turn; nil if the
  #                      assistant never emitted the final tool call.
  #   valid            — whether the proposal passed validation; nil when
  #                      there is no proposal.
  #   errors           — validation errors of the last failed attempt.
  #   retry_count      — how many tool-call retries were consumed.
  class ToolCallingResult
    # Assistant replied with plain text (no tool call). Chat continues.
    AWAITING_INPUT = :awaiting_input

    # A valid proposal was produced. Chat state now holds it.
    PROPOSAL_READY = :proposal_ready

    # A tool call was produced but the proposal kept failing validation
    # and we exhausted the retry budget. Chat state holds the last
    # (invalid) proposal plus the errors, so the frontend can offer the
    # manual catalog fallback.
    RETRIES_EXHAUSTED = :retries_exhausted

    # The AI subsystem is not configured (Null adapter) — no real call
    # was attempted. Controller surfaces a "AI is not configured" notice.
    NOT_CONFIGURED = :not_configured

    # The provider returned an error we don't retry (auth, client, parse).
    # The turn ends; the user can send another message.
    PROVIDER_ERROR = :provider_error

    STATUSES = [
      AWAITING_INPUT,
      PROPOSAL_READY,
      RETRIES_EXHAUSTED,
      NOT_CONFIGURED,
      PROVIDER_ERROR
    ].freeze

    attr_reader :status, :messages_created, :proposal, :valid, :errors,
                :retry_count, :provider_error_message

    def initialize(
      status:,
      messages_created: [],
      proposal: nil,
      valid: nil,
      errors: [],
      retry_count: 0,
      provider_error_message: nil
    )
      unless STATUSES.include?(status)
        raise ArgumentError, "Unknown status: #{status.inspect}"
      end

      @status               = status
      @messages_created     = messages_created
      @proposal             = proposal
      @valid                = valid
      @errors               = Array(errors)
      @retry_count          = retry_count
      @provider_error_message = provider_error_message
    end

    def proposal_ready?
      status == PROPOSAL_READY
    end

    def awaiting_input?
      status == AWAITING_INPUT
    end

    def retries_exhausted?
      status == RETRIES_EXHAUSTED
    end

    def not_configured?
      status == NOT_CONFIGURED
    end

    def provider_error?
      status == PROVIDER_ERROR
    end
  end
end
