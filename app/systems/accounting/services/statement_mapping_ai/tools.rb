require "ruby_llm"

module Accounting
  module StatementMappingAi
    # Read-only tools the mapping assistant calls to look the chart of
    # accounts and balances up. Each wraps a Context; none changes data.
    # Balances are debit positive (credit balances negative).
    module Tools
      class Base < RubyLLM::Tool
        def initialize(context)
          super()
          @context = context
        end

        def name
          self.class::NAME
        end

        private

        attr_reader :context
      end

      class ListLedgers < Base
        NAME = "list_ledgers"
        description "Lists every ledger of the chart of accounts: full code, names (en/fa), category identifier " \
                    "(CA LA CL LL OE RE EX CO ME), monetary flag, the ledger it is a contra of, number of accounts " \
                    "and current balance (debit positive)."

        def execute
          { ledgers: context.ledgers }
        end
      end

      class AccountsInLedger < Base
        NAME = "accounts_in_ledger"
        description "Lists the accounts of one ledger with full codes, names, contra links and current balances."
        parameter :ledger_code, description: "Full code of the ledger, e.g. \"111\""

        def execute(ledger_code:)
          context.accounts_in(ledger_code) || { error: "Unknown ledger #{ledger_code}" }
        end
      end

      class BalanceSigns < Base
        NAME = "balance_signs"
        description "Shows how an account's balance splits over the centers (e.g. customers, suppliers) of one " \
                    "center level: how many are in debit and in credit, and their totals. Use it to decide whether " \
                    "a rule needs an opposite line with a per-center grain."
        parameter :account_code, description: "Full code of the account"
        parameter :center_level, type: "integer", description: "Center level, 1 to 6"

        def execute(account_code:, center_level:)
          context.balance_signs(account_code, center_level) || { error: "Unknown account #{account_code}" }
        end
      end

      class UnmappedBalances < Base
        NAME = "unmapped_balances"
        description "Lists the accounts whose balances no current rule maps to a line, with their balances."

        def execute
          { unmapped: context.unmapped }
        end
      end

      def self.for(context)
        [ ListLedgers, AccountsInLedger, BalanceSigns, UnmappedBalances ].map { |klass| klass.new(context) }
      end
    end
  end
end
