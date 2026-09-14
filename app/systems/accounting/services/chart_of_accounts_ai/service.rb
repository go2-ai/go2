# frozen_string_literal: true

module Accounting
  module ChartOfAccountsAi
    # Orchestrates a single turn of the chart-of-accounts AI chat.
    #
    # Input:  a chat (AiChat) and a new user message (String).
    # Output: an Accounting::ChartOfAccountsAi::Result describing what
    #         happened, plus the AiMessage records created during this turn.
    #
    # The service persists incrementally — every step that produces a
    # message writes it immediately. If a later step raises, the messages
    # already written stay. That's why we do NOT wrap the loop in a
    # transaction: a partially-completed conversation is a correct
    # outcome for a chat log, and rolling back the user's own message
    # would be confusing.
    #
    # See Accounting::ChartOfAccountsAi::Result for the set of terminal
    # states this can return.
    class Service
      # Total attempts = initial + retries. Bounded so a single turn
      # can't sit in a slow provider loop for minutes.
      MAX_ATTEMPTS = 3

      # Backoff for rate-limit retries only. Other retryable errors
      # (network, 5xx) retry immediately — a brief outage is unlikely
      # to resolve in one second, and hammering wouldn't help either.
      RATE_LIMIT_BACKOFF_SECONDS = 1

      # The tool name we expect the model to call. Matches
      # Accounting::ChartOfAccountsAi::ToolSchema::TOOL_NAME.
      TOOL_NAME = ToolSchema::TOOL_NAME

      def self.call(chat:, user_content:, persist_user_message: true)
        new(chat: chat, user_content: user_content, persist_user_message: persist_user_message).call
      end

      def initialize(chat:, user_content:, persist_user_message: true)
        @chat = chat
        @user_content = user_content.to_s
        @organization = chat.organization
        @persist_user_message = persist_user_message
      end

      def call
        return not_configured_result unless Ai::Client.available?
        messages_created = []
        messages_created << persist_user_message_record if @persist_user_message
        run_attempt_loop(messages_created)
      end

      private

      attr_reader :chat, :user_content, :organization

      # ── Persistence primitives ──────────────────────────────────────────

      def persist_user_message
        chat.append_message!(
          role: "user",
          content: user_content,
          sender_member: chat.member
        )
      end

      def persist_assistant_message(content)
        chat.append_message!(role: "assistant", content: content)
      end

      def persist_tool_error_message(errors)
        chat.append_message!(role: "tool", content: format_tool_error_content(errors))
      end

      # The AI provider isn't configured (Null adapter in use). Persist a
      # user-visible assistant message so the chat doesn't silently swallow
      # the user's turn — otherwise the frontend shows "thinking…" and then
      # abruptly stops with no explanation.
      def not_configured_result
        message = chat.append_message!(
          role: "assistant",
          content: "The AI assistant isn't configured on this server. " \
                   "Please contact your administrator or try again later.",
          metadata: { "error" => true, "error_kind" => "not_configured" }
        )

        Result.new(
          status: Result::NOT_CONFIGURED,
          messages_created: [ message ]
        )
      end

      # ── Attempt loop ────────────────────────────────────────────────────

      def run_attempt_loop(messages_created)
        attempt       = 0
        retries_used  = 0
        last_proposal = nil
        last_errors   = []

        while attempt < MAX_ATTEMPTS
          attempt += 1

          begin
            response = call_ai
          rescue Ai::Error => e
            messages_created << persist_tool_error_message(
              [ {
                path:    "provider",
                field:   "request",
                message: "#{e.class.name.split('::').last}: #{e.message}"
              } ]
            )

            if retryable?(e) && attempt < MAX_ATTEMPTS
              retries_used += 1
              sleep(RATE_LIMIT_BACKOFF_SECONDS) if e.is_a?(Ai::RateLimitError)
              next
            end

            return Result.new(
              status:                  Result::PROVIDER_ERROR,
              messages_created:        messages_created,
              provider_error_message:  e.message,
              retry_count:             retries_used
            )
          end

          # ── Plain text reply — no tool call ────────────────────────────
          unless response.tool_calls?
            messages_created << persist_assistant_message(response.content)
            return Result.new(
              status:           Result::AWAITING_INPUT,
              messages_created: messages_created,
              retry_count:      retries_used
            )
          end

          # ── Tool call present ──────────────────────────────────────────
          tool_call = find_target_tool_call(response)

          unless tool_call
            # The model called a different tool. We have no handler for it,
            # so treat the turn as a plain assistant reply and let the user
            # continue. Persist whatever text accompanied the tool call.
            messages_created << persist_assistant_message(response.content.to_s)
            return Result.new(
              status:           Result::AWAITING_INPUT,
              messages_created: messages_created,
              retry_count:      retries_used
            )
          end

          proposal = Accounting::ChartOfAccountsProposal.from(tool_call[:arguments])
          validation = Accounting::ChartOfAccountsProposalValidator.call(
            proposal:     proposal,
            organization: organization
          )

          last_proposal = proposal
          last_errors   = validation.errors

          if validation.valid?
            messages_created << persist_assistant_message(
              response.content.presence || build_success_summary(proposal)
            )

            merge_chat_state(
              latest_proposal: tool_call[:arguments],
              valid:           true,
              errors:          []
            )

            return Result.new(
              status:           Result::PROPOSAL_READY,
              messages_created: messages_created,
              proposal:         proposal,
              valid:            true,
              errors:           [],
              retry_count:      retries_used
            )
          end

          # Invalid proposal — record the errors as a tool message so the
          # next LLM call sees them, and record the invalid proposal in
          # chat state so the frontend can display it alongside the errors.
          messages_created << persist_tool_error_message(validation.errors)

          merge_chat_state(
            latest_proposal: tool_call[:arguments],
            valid:           false,
            errors:          serialize_errors(validation.errors)
          )

          if attempt >= MAX_ATTEMPTS
            messages_created << persist_assistant_message(
              build_retries_exhausted_message(validation.errors)
            )

            return Result.new(
              status:           Result::RETRIES_EXHAUSTED,
              messages_created: messages_created,
              proposal:         last_proposal,
              valid:            false,
              errors:           last_errors,
              retry_count:      retries_used
            )
          end

          retries_used += 1
        end

        # Defensive fallback — every path inside the loop returns, but
        # guard against MAX_ATTEMPTS ever being set to 0.
        Result.new(
          status:           Result::RETRIES_EXHAUSTED,
          messages_created: messages_created,
          proposal:         last_proposal,
          valid:            false,
          errors:           last_errors,
          retry_count:      retries_used
        )
      end

      # ── AI call ─────────────────────────────────────────────────────────

      def call_ai
        Ai::Client.complete(
          messages: Prompt.build_messages(
            chat: chat, organization: organization,
            override_last_user_content: @persist_user_message ? nil : user_content
          ),
          tools: [ ToolSchema.definition ]
        )
      end

      # Provider errors we consider transient enough to retry within the
      # budget. Anything else (auth, bad request, parse failure) is
      # deterministic — retrying would waste quota and time.
      #
      # Resolved lazily (not stored in a class-level constant) because
      # these constants live in app/services/ai/, and Zeitwerk's
      # eager-load order is not guaranteed to visit those files before
      # this one. Referencing them at method-call time sidesteps the
      # ordering issue entirely.
      def retryable_error_classes
        [
          Ai::NetworkError,
          Ai::RateLimitError,
          Ai::ServerError
        ]
      end

      def retryable?(error)
        retryable_error_classes.any? { |klass| error.is_a?(klass) }
      end

      # ── Tool-call extraction ────────────────────────────────────────────

      def find_target_tool_call(response)
        response.tool_calls.find { |tc| tc[:name] == TOOL_NAME }
      end

      # ── State persistence ───────────────────────────────────────────────

      def merge_chat_state(latest_proposal:, valid:, errors:)
        new_state = {
          "latest_proposal" => latest_proposal,
          "valid"           => valid,
          "errors"          => errors,
          "last_updated_at" => Time.current.iso8601
        }
        chat.update!(state: chat.state.merge(new_state))
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

      # ── Message content builders ────────────────────────────────────────

      def format_tool_error_content(errors)
        lines = errors.map do |err|
          path    = err.respond_to?(:path) ? err.path : "?"
          field   = err.respond_to?(:field) ? err.field : "?"
          message = err.respond_to?(:message) ? err.message : err.to_s
          "- #{path} (#{field}): #{message}"
        end

        "The proposal was rejected with the following errors. " \
          "Fix every one and call #{TOOL_NAME} again with a corrected proposal:\n" +
          lines.join("\n")
      end

      def build_success_summary(proposal)
        ledger_count  = proposal.ledgers.length
        account_count = proposal.accounts.length

        "I've prepared a chart of accounts with " \
          "#{ledger_count} #{pluralize(ledger_count, 'ledger')} and " \
          "#{account_count} #{pluralize(account_count, 'account')}. " \
          "Review it on the left and accept, or tell me what to change."
      end

      def build_retries_exhausted_message(errors)
        visible = errors.first(3).map do |err|
          path    = err.respond_to?(:path) ? err.path : "?"
          message = err.respond_to?(:message) ? err.message : err.to_s
          "- #{path}: #{message}"
        end

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

      def pluralize(count, singular)
        count == 1 ? singular : "#{singular}s"
      end

      def persist_user_message_record
        chat.append_message!(role: "user", content: user_content, sender_member: chat.member)
      end
    end
  end
end
