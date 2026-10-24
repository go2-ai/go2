module Accounting
  module StatementMappingAi
    # One turn of the statement mapping assistant. The chat's subject is the
    # statement report; the model looks the chart up with read-only tools
    # and answers with propose_mapping_rules, validated before it reaches
    # the user (chat.state["latest_proposal"]).
    class Service < Ai::ToolCallingService
      FEATURE_KEY = "statement_mapping"

      private

      def feature_name
        FEATURE_KEY
      end

      def report
        @report ||= chat.subject
      end

      def context
        @context ||= Context.new(report)
      end

      def tool_name
        ToolSchema::TOOL_NAME
      end

      def tool_definition
        ToolSchema.definition
      end

      def lookup_tools
        Tools.for(context)
      end

      Validation = Struct.new(:errors) do
        def valid?
          errors.empty?
        end
      end

      def validate_tool_call(tool_call)
        proposal = Proposal.from(tool_call[:arguments], layout: report.statement_layout)
        errors = proposal.errors
        errors << Proposal::Error.new(path: "changes", field: "changes", message: Proposal.message(:empty)) if proposal.changes.empty?
        Validation.new(errors)
      end

      def build_success_summary(tool_call:, validation:)
        proposal = Proposal.from(tool_call[:arguments], layout: report.statement_layout)
        proposal.summary.presence || "I've proposed #{proposal.changes.size} rule changes. Review them with the preview."
      end

      def build_retries_exhausted_message(errors:)
        details = errors.first(3).map { |error| "- #{format_validation_error(error)}" }.join("\n")
        "I couldn't produce valid rules after a few tries:\n#{details}\n\nTell me what to adjust."
      end

      def on_validation_passed(tool_call:, validation:, response:, messages_created:)
        content = response.content.presence || build_success_summary(tool_call: tool_call, validation: validation)
        messages_created << persist_assistant_message(content, response: response)
        merge_chat_state(latest_proposal: tool_call[:arguments], valid: true, errors: [], last_updated_at: Time.current.iso8601)
        { proposal: tool_call[:arguments], valid: true, errors: [] }
      end

      def on_validation_failed(tool_call:, errors:, response:, messages_created:)
        merge_chat_state(latest_proposal: tool_call[:arguments], valid: false,
                         errors: serialize_errors(errors),
                         last_updated_at: Time.current.iso8601)
      end

      def on_retries_exhausted(errors:, messages_created:)
        messages_created << persist_assistant_message(build_retries_exhausted_message(errors: errors))
        { valid: false, errors: errors }
      end

      def result_class
        Result
      end

      def build_messages
        Prompt.build_messages(chat: chat, context: context,
                              override_last_user_content: @persist_user_message ? nil : user_content)
      end
    end
  end
end
