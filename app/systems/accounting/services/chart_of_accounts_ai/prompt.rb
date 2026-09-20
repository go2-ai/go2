# frozen_string_literal: true

module Accounting
  module ChartOfAccountsAi
    # The system prompt for the chart-of-accounts assistant, plus helpers
    # for building the full message history sent to the LLM.
    #
    # The system prompt is a Ruby heredoc (not an external file). The
    # prompt is still evolving, and a heredoc iterates faster than file
    # I/O. When the prompt stabilizes, move it to a file next to this
    # class — the call site (`Prompt.system_prompt`) won't need to change.
    class Prompt
      def self.system_prompt(organization:)
        new(organization: organization).system_prompt
      end

      def self.build_messages(chat:, organization:, system: nil, override_last_user_content: nil)
        new(organization: organization, chat: chat, explicit_system: system)
          .build_messages(override_last_user_content: override_last_user_content)
      end

      MAX_MESSAGES = 30

      def initialize(organization:, chat: nil, explicit_system: nil)
        @organization    = organization
        @chat            = chat
        @explicit_system = explicit_system
      end

      def system_prompt
        return @explicit_system if @explicit_system.present?

        [ base_prompt, context_block ].join("\n\n")
      end

      # Builds the full messages array (including the system message as
      # index 0) for the LLM. Truncates to the last MAX_MESSAGES turns,
      # keeping the system message always.
      #
      # Message shapes:
      #   user      → { role: "user", content: "..." }
      #   assistant → { role: "assistant", content: "..." }
      #   tool      → { role: "user", content: "[Tool result] ..." }
      #
      # We flatten tool messages into user messages because OpenRouter's
      # OpenAI-compatible shape requires an assistant message with
      # tool_calls immediately before a tool-result message — which is
      # hard to reconstruct correctly from our simplified message store.
      # Flattening sidesteps the whole tool-call/result pairing problem
      # at the cost of slightly less model-friendly context. Acceptable
      # for v1; revisit if the model starts ignoring tool feedback.
      def build_messages(override_last_user_content: nil)
        raise ArgumentError, "chat is required" if @chat.nil?

        history = @chat.messages.chronological.to_a
        history = history.last(MAX_MESSAGES) if history.length > MAX_MESSAGES

        messages = [ { role: "system", content: system_prompt } ]

        history.each do |msg|
          messages << format_message(msg)
        end

        if override_last_user_content.present?
          idx = messages.rindex { |m| m[:role] == "user" }
          messages[idx] = { role: "user", content: override_last_user_content } if idx
        end
        messages
      end

      private

      def format_message(msg)
        case msg.role
        when "user"
          { role: "user", content: msg.content.to_s }
        when "assistant"
          { role: "assistant", content: msg.content.to_s }
        when "tool"
          # Tool results are fed back as user messages with a marker so
          # the model knows they came from its own tool call.
          { role: "user", content: "[Tool result]\n#{msg.content}" }
        else
          { role: "user", content: msg.content.to_s }
        end
      end

      def base_prompt
        <<~PROMPT.strip
          You are an accounting assistant helping a user design a chart of
          accounts for their organization. Your job is to produce a
          reliable, working chart — not a plausible-looking guess.

          ## How to work
          1. Read the user's message carefully. If they describe their
             business, use that. If they upload or paste data, use it.
          2. Ask ONE or TWO clarifying questions at a time if anything
             material is unclear. Do not interrogate.
          3. When you have enough information, call the
             `propose_chart_of_accounts` tool with a complete proposal.
          4. If the tool returns validation errors, fix them and try again.
          5. If you cannot produce a valid proposal after two attempts,
             explain what's blocking you and offer to start from one of the
             starter catalogs verbatim.

          ## What makes a chart "work"
          - Every ledger has at least one account.
          - Code suffixes match the organization's configured lengths
            exactly (see the context below).
          - `is_monetary: true` appears only on CA, LA, CL, LL, OE ledgers.
          - Ledger and account names are provided for the primary locale at
            minimum, and translated for the other active locales when you
            can produce good translations.
          - The chart is complete enough to record real transactions: cash,
            receivables, payables, equity, revenue, and the common expense
            categories for the described business.

          ## Style
          - Answer in the user's language.
          - Be concise. No preamble, no "certainly!".
          - When you produce a proposal, summarize it in one or two
            sentences — the user will see the full tree in the UI.
        PROMPT
      end

      def context_block
        "## Context\n\n#{ContextBuilder.call(organization: @organization)}"
      end
    end
  end
end
