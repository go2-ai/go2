# frozen_string_literal: true

module Accounting
  module ChartOfAccountsAi
    # Orchestrates a single turn of the chart-of-accounts AI chat.
    #
    # All the machinery — attempt loop, retryable-error handling,
    # tool-call extraction, message persistence, usage attribution —
    # lives in Ai::ToolCallingService. This class declares the
    # chart-specific policy.
    #
    # The feature name pins the AI config lookup to
    # AI_PROVIDER__CHART_OF_ACCOUNTS / AI_MODEL__CHART_OF_ACCOUNTS.
    # That way, if a future requirement says "the chart assistant needs
    # a stronger model than the other features," it's a .env change, not
    # a code change here.
    class Service < Ai::ToolCallingService
      TOOL_NAME   = ToolSchema::TOOL_NAME
      FEATURE_KEY = "chart_of_accounts"

      private

      # ── Feature scope ─────────────────────────────────────────────────

      def feature_name
        FEATURE_KEY
      end

      # ── Declarative hooks ─────────────────────────────────────────────
      # (unchanged)

      def tool_name
        TOOL_NAME
      end

      def tool_definition
        ToolSchema.definition
      end

      def validate_tool_call(tool_call)
        proposal = Accounting::ChartOfAccountsProposal.from(tool_call[:arguments])
        Accounting::ChartOfAccountsProposalValidator.call(
          proposal:     proposal,
          organization: organization
        )
      end

      def build_success_summary(tool_call:, validation:)
        proposal      = Accounting::ChartOfAccountsProposal.from(tool_call[:arguments])
        ledger_count  = proposal.ledgers.length
        account_count = proposal.accounts.length

        "I've prepared a chart of accounts with " \
          "#{ledger_count} #{pluralize(ledger_count, 'ledger')} and " \
          "#{account_count} #{pluralize(account_count, 'account')}. " \
          "Review it on the left and accept, or tell me what to change."
      end

      def build_retries_exhausted_message(errors:)
        visible = errors.first(3).map { |err| "- #{format_validation_error(err)}" }

        starter_catalogs = Accounting::Catalogs.available

        catalog_hint =
          if starter_catalogs.any?
            " You can also start from a starter catalog as-is " \
              "(#{starter_catalogs.join(', ')}) — just tell me which one."
          else
            ""
          end

        "I wasn't able to produce a valid chart of accounts after a few tries. " \
          "The most recent attempt had these issues:\n" +
          visible.join("\n") +
          "\n\nTell me what to adjust, or describe the business differently.#{catalog_hint}"
      end

      def format_validation_error(err)
        path    = err.respond_to?(:path) ? err.path : "?"
        field   = err.respond_to?(:field) ? err.field : "?"
        message = err.respond_to?(:message) ? err.message : err.to_s
        "#{path} (#{field}): #{message}"
      end

      # ── Lifecycle hooks ───────────────────────────────────────────────
      # (unchanged)

      def on_validation_passed(tool_call:, validation:, response:, messages_created:)
        proposal = Accounting::ChartOfAccountsProposal.from(tool_call[:arguments])

        messages_created << persist_assistant_message(
          response_content_or_summary(response, tool_call, validation),
          response: response
        )

        merge_chat_state(
          latest_proposal: tool_call[:arguments],
          valid:           true,
          errors:          [],
          last_updated_at: Time.current.iso8601
        )

        { proposal: proposal, valid: true, errors: [] }
      end

      def on_validation_failed(tool_call:, errors:, response:, messages_created:)
        @last_failed_tool_call = tool_call

        merge_chat_state(
          latest_proposal: tool_call[:arguments],
          valid:           false,
          errors:          serialize_errors(errors),
          last_updated_at: Time.current.iso8601
        )
      end

      def on_retries_exhausted(errors:, messages_created:)
        messages_created << persist_assistant_message(
          build_retries_exhausted_message(errors: errors)
        )

        {
          proposal: last_failed_proposal,
          valid:    false,
          errors:   errors
        }
      end

      # ── Result class ──────────────────────────────────────────────────

      def result_class
        Result
      end

      # ── Message building ──────────────────────────────────────────────

      def build_messages
        Prompt.build_messages(
          chat:         chat,
          organization: organization,
          override_last_user_content: @persist_user_message ? nil : user_content
        )
      end

      # ── Helpers ───────────────────────────────────────────────────────

      def response_content_or_summary(response, tool_call, validation)
        return response.content if response.content.present?

        build_success_summary(tool_call: tool_call, validation: validation)
      end

      def last_failed_proposal
        return nil unless @last_failed_tool_call

        Accounting::ChartOfAccountsProposal.from(@last_failed_tool_call[:arguments])
      end

      def serialize_errors(errors)
        errors.map do |err|
          {
            "path"    => err.respond_to?(:path) ? err.path : nil,
            "field"   => err.respond_to?(:field) ? err.field : nil,
            "message" => err.respond_to?(:message) ? err.message : err.to_s
          }
        end
      end

      def pluralize(count, singular)
        count == 1 ? singular : "#{singular}s"
      end
    end
  end
end