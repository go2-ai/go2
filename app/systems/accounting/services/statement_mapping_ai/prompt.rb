module Accounting
  module StatementMappingAi
    # System prompt and message history of the mapping assistant. Tool
    # messages are flattened into user messages, as in the chart-of-accounts
    # assistant (see ChartOfAccountsAi::Prompt).
    class Prompt
      MAX_MESSAGES = 30

      def self.build_messages(chat:, context:, override_last_user_content: nil)
        new(chat: chat, context: context).build_messages(override_last_user_content)
      end

      def initialize(chat:, context:)
        @chat = chat
        @context = context
      end

      def build_messages(override_last_user_content)
        Ai::PromptHistory.build(chat: chat, system: system_prompt, override_last_user_content: override_last_user_content,
                                max: MAX_MESSAGES)
      end

      def system_prompt
        [ instructions, context_block ].join("\n\n")
      end

      private

      attr_reader :chat, :context

      def instructions
        <<~PROMPT
          You help an accountant map the balances of their chart of accounts to the lines of a financial
          statement ("#{context.report.name}", type #{context.layout.statement_type}). Answer in the user's
          language. You never compute figures: the application does, from the rules you propose.

          How mapping works:
          - A rule selects balances and sends them to a line. Selectors: category (identifiers CA current
            assets, LA non-current assets, CL current liabilities, LL non-current liabilities, OE equity,
            RE revenue, EX expenses), ledger (ledger_codes), account (account_codes, or settings for the
            accounts named in the accounting settings), account_range (from/to prefixes of full account codes),
            profit_or_loss (income statement balances of the current fiscal year or of prior years).
          - When several rules match a balance, the highest priority wins; with equal priorities the most
            specific wins: account > account_range > ledger > category, and center or currency filters make a
            rule more specific. So prefer specific rules over priorities; use priority only when needed.
          - opposite_line_key sends balances on the side opposite to the line's normal side to another line,
            judged per grain. Example: receivables with grain account_center1 (customers): customers in credit
            go to advances from customers, the others stay receivables (gross, as IFRS requires).
          - measure: balance (default); change (the period's movement; cash flow lines); debit_movement and
            credit_movement (one side only, e.g. purchases of equipment, depreciation charged).
          - Rules with center_level plus center_codes or center_type_names apply to those centers only.
          - The preset's category rules are catch-alls; refine them with ledger or account rules rather than
            removing them, so new accounts are still mapped.

          How to work:
          - Look the chart up with the tools (list_ledgers, accounts_in_ledger, balance_signs,
            unmapped_balances) before proposing. Use names, codes, contra links and balance signs.
          - Map each ledger to the most fitting line; go down to accounts only when a ledger mixes lines.
          - For receivable and payable ledgers with centers, check balance_signs and propose opposite lines when
            some centers are on the other side.
          - Then call #{ToolSchema::TOOL_NAME} with all changes, each with a short reason and a confidence
            (0 to 1). Use codes exactly as the tools return them; only lines that exist and aren't headings.
          - If the request is unclear, ask one short question instead of proposing.
        PROMPT
      end

      def context_block
        parts = []
        parts << "Statement lines (key, parent, kind, side, label):\n#{JSON.generate(context.lines)}"
        parts << "Current rules:\n#{JSON.generate(context.rules)}"
        parts << "Center levels in use: #{context.center_levels}; center types: #{context.center_types.join(', ')}; " \
                 "currencies: #{context.currencies.join(', ')}"
        if context.ledger_count <= Context::INLINE_LEDGERS
          parts << "Ledgers:\n#{JSON.generate(context.ledgers)}"
        else
          parts << "The chart has #{context.ledger_count} ledgers: use list_ledgers to read them."
        end
        parts.join("\n\n")
      end
    end
  end
end
