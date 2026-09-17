# frozen_string_literal: true

module Ai
  # Base class for any AI feature that drives a single tool call in an
  # attempt loop with validation, retries, and chat-state persistence.
  #
  # (design notes unchanged — see previous version)
  #
  # ── Feature scoping ──────────────────────────────────────────────────
  #
  # The service tells Ai::Client which feature it belongs to by way of
  # `feature_name` (default: `chat.kind`). That name drives the
  # feature-specific env var lookup in Ai::Client:
  #
  #   AI_PROVIDER__CHART_OF_ACCOUNTS
  #   AI_MODEL__CHART_OF_ACCOUNTS
  #
  # A feature that wants a stronger model than the global default simply
  # sets AI_MODEL__<FEATURE> in the environment — no code change.
  class ToolCallingService
    MAX_ATTEMPTS = 3
    RATE_LIMIT_BACKOFF_SECONDS = 1

    def self.call(chat:, user_content:, persist_user_message: true)
      new(chat: chat, user_content: user_content, persist_user_message: persist_user_message).call
    end

    def initialize(chat:, user_content:, persist_user_message: true)
      @chat                 = chat
      @user_content         = user_content.to_s
      @organization         = chat.organization
      @persist_user_message = persist_user_message
    end

    def call
      return not_configured_result unless Ai::Client.available?(feature: feature_name)

      messages_created = []
      messages_created << persist_user_message_record if @persist_user_message
      run_attempt_loop(messages_created)
    end

    private

    attr_reader :chat, :user_content, :organization

    # ── Feature scope ───────────────────────────────────────────────────

    # Name used to look up feature-scoped AI config (AI_MODEL__<NAME>,
    # AI_PROVIDER__<NAME>). Defaults to the chat's kind. Subclasses
    # override to pin the name even if the chat kind ever changes.
    def feature_name
      chat.kind
    end

    # ── Subclass hooks: declarative ─────────────────────────────────────
    # (unchanged)

    def tool_name
      raise NotImplementedError, "#{self.class} must implement #tool_name"
    end

    def tool_definition
      raise NotImplementedError, "#{self.class} must implement #tool_definition"
    end

    def validate_tool_call(_tool_call)
      raise NotImplementedError, "#{self.class} must implement #validate_tool_call"
    end

    def build_success_summary(_tool_call:, _validation:)
      raise NotImplementedError, "#{self.class} must implement #build_success_summary"
    end

    def build_retries_exhausted_message(_errors:)
      raise NotImplementedError, "#{self.class} must implement #build_retries_exhausted_message"
    end

    def format_validation_error(_error)
      raise NotImplementedError, "#{self.class} must implement #format_validation_error"
    end

    # ── Subclass hooks: lifecycle ───────────────────────────────────────

    def on_validation_passed(tool_call:, validation:, response:, messages_created:)
      raise NotImplementedError, "#{self.class} must implement #on_validation_passed"
    end

    def on_validation_failed(tool_call:, errors:, response:, messages_created:)
      raise NotImplementedError, "#{self.class} must implement #on_validation_failed"
    end

    def on_retries_exhausted(errors:, messages_created:)
      raise NotImplementedError, "#{self.class} must implement #on_retries_exhausted"
    end

    # ── Overridable defaults ────────────────────────────────────────────

    def not_configured_message
      "The AI assistant isn't configured on this server. " \
        "Please contact your administrator or try again later."
    end

    def result_class
      Result
    end

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

    # ── Attempt loop ────────────────────────────────────────────────────
    # (unchanged from the previous version; verbatim)

    def run_attempt_loop(messages_created)
      attempt      = 0
      retries_used = 0

      while attempt < MAX_ATTEMPTS
        attempt += 1

        begin
          response = call_ai
        rescue Ai::Error => e
          messages_created << persist_tool_error_message(
            errors:   [ provider_error_stub(e) ],
            response: nil
          )

          if retryable?(e) && attempt < MAX_ATTEMPTS
            retries_used += 1
            sleep(RATE_LIMIT_BACKOFF_SECONDS) if e.is_a?(Ai::RateLimitError)
            next
          end

          return result_class.new(
            status:                 result_class::PROVIDER_ERROR,
            messages_created:       messages_created,
            provider_error_message: e.message,
            retry_count:            retries_used
          )
        end

        unless response.tool_calls?
          messages_created << persist_assistant_message(response.content, response: response)
          return result_class.new(
            status:           result_class::AWAITING_INPUT,
            messages_created: messages_created,
            retry_count:      retries_used
          )
        end

        tool_call = find_target_tool_call(response)

        unless tool_call
          messages_created << persist_assistant_message(response.content.to_s, response: response)
          return result_class.new(
            status:           result_class::AWAITING_INPUT,
            messages_created: messages_created,
            retry_count:      retries_used
          )
        end

        validation = validate_tool_call(tool_call)

        if validation.valid?
          extras = on_validation_passed(
            tool_call:        tool_call,
            validation:       validation,
            response:         response,
            messages_created: messages_created
          )

          return result_class.new(
            status:           result_class::PROPOSAL_READY,
            messages_created: messages_created,
            retry_count:      retries_used,
            **extras
          )
        end

        messages_created << persist_tool_error_message(
          errors:   validation.errors,
          response: response
        )

        on_validation_failed(
          tool_call:        tool_call,
          errors:           validation.errors,
          response:         response,
          messages_created: messages_created
        )

        if attempt >= MAX_ATTEMPTS
          extras = on_retries_exhausted(
            errors:           validation.errors,
            messages_created: messages_created
          )

          return result_class.new(
            status:           result_class::RETRIES_EXHAUSTED,
            messages_created: messages_created,
            retry_count:      retries_used,
            **extras
          )
        end

        retries_used += 1
      end

      extras = on_retries_exhausted(
        errors:           [],
        messages_created: messages_created
      )

      result_class.new(
        status:           result_class::RETRIES_EXHAUSTED,
        messages_created: messages_created,
        retry_count:      retries_used,
        **extras
      )
    end

    # ── AI call ─────────────────────────────────────────────────────────

    def call_ai
      Ai::Client.complete(
        messages: build_messages,
        tools:    [ tool_definition ],
        feature:  feature_name
      )
    end

    def build_messages
      raise NotImplementedError, "#{self.class} must implement #build_messages"
    end

    # ── Tool-call extraction ────────────────────────────────────────────

    def find_target_tool_call(response)
      response.tool_calls.find { |tc| tc[:name] == tool_name }
    end

    # ── Persistence primitives ──────────────────────────────────────────

    def persist_user_message_record
      chat.append_message!(role: "user", content: user_content, sender_member: chat.member)
    end

    def persist_assistant_message(content, response: nil)
      chat.append_message!(
        role:     "assistant",
        content:  content,
        metadata: usage_metadata(response)
      )
    end

    def persist_tool_error_message(errors:, response: nil)
      chat.append_message!(
        role:     "tool",
        content:  format_tool_error_content(errors),
        metadata: usage_metadata(response)
      )
    end

    def format_tool_error_content(errors)
      lines = errors.map { |err| "- #{format_validation_error(err)}" }
      "The tool call was rejected with the following errors. " \
        "Fix every one and call #{tool_name} again with a corrected input:\n" +
        lines.join("\n")
    end

    def usage_metadata(response)
      return {} if response.nil?
      return {} if response.usage.blank?

      {
        "usage" => {
          "provider"          => response.provider,
          "model"             => response.model,
          "prompt_tokens"     => response.usage["prompt_tokens"] || response.usage[:prompt_tokens],
          "completion_tokens" => response.usage["completion_tokens"] || response.usage[:completion_tokens],
          "total_tokens"      => response.usage["total_tokens"] || response.usage[:total_tokens],
          "raw"               => response.usage
        }
      }
    end

    # ── State persistence ───────────────────────────────────────────────

    def merge_chat_state(**new_keys)
      chat.update!(state: chat.state.merge(stringify_keys(new_keys)))
    end

    def stringify_keys(hash)
      hash.transform_keys(&:to_s)
    end

    # ── Terminal results ────────────────────────────────────────────────

    def not_configured_result
      message = chat.append_message!(
        role:     "assistant",
        content:  not_configured_message,
        metadata: { "error" => true, "error_kind" => "not_configured" }
      )

      result_class.new(
        status:           result_class::NOT_CONFIGURED,
        messages_created: [ message ]
      )
    end

    def provider_error_stub(error)
      {
        path:    "provider",
        field:   "request",
        message: "#{error.class.name.split('::').last}: #{error.message}"
      }
    end
  end
end