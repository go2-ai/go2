# frozen_string_literal: true

module Accounting
  module ChartOfAccountsAi
    # The JSON schema for the `propose_chart_of_accounts` tool, in
    # OpenAI's tool-definition format. OpenRouter is OpenAI-compatible
    # so the same shape applies.
    #
    # The schema mirrors the catalog YAML format exactly (see
    # app/systems/accounting/catalogs/README.md) — one shape to learn,
    # one shape to validate, one shape to persist.
    #
    # This class is pure data. It has no behavior beyond returning a
    # frozen hash. Any change to the catalog format must be reflected
    # here, and the tool_schema_spec asserts the two stay in sync via
    # a round-trip: a proposal produced against this schema must be
    # structurally parseable by Accounting::ChartOfAccountsProposal.
    class ToolSchema
      TOOL_NAME = "propose_chart_of_accounts"

      DESCRIPTION = <<~DESC.strip
        Propose a complete chart of accounts for the current organization.
        Call this tool ONLY when you have enough information to build a
        reliable, working chart — ask clarifying questions first if you
        are missing key context (industry, multi-currency needs,
        language requirements, etc.).

        The proposal is validated against the organization's accounting
        settings (code lengths, allowed monetary categories, etc.). If
        validation fails, you will receive the errors as a tool result
        and may try again with a corrected proposal.

        The proposal format mirrors the catalog format exactly:
          - `categories`: leave empty to rely on the nine system
            categories (CA, LA, CL, LL, OE, RE, EX, CO, ME). Only declare
            custom categories here, and each must have type "other" and
            a unique code.
          - `ledgers`: each references a category by identifier (for
            system categories) or by code (for custom categories). Code
            is a suffix whose length must match `ledger_length`.
          - `accounts`: each references a ledger as
            "<category_ref>.<ledger_code>". Code is a suffix whose
            length must match `account_length`.

        Every ledger MUST have at least one account.
      DESC

      def self.definition
        {
          type: "function",
          function: {
            name: TOOL_NAME,
            description: DESCRIPTION,
            parameters: {
              type: "object",
              required: [ "categories", "ledgers", "accounts" ],
              additionalProperties: false,
              properties: {
                categories: {
                  type: "array",
                  items: {
                    type: "object",
                    required: [ "code", "name", "type" ],
                    additionalProperties: false,
                    properties: {
                      identifier: {
                        type: [ "string", "null" ],
                        description: "System category identifier (CA, LA, CL, LL, OE, RE, EX, CO, ME) or null for a custom category."
                      },
                      code: {
                        type: "string",
                        description: "Category code suffix. Its length must match account_category_length. Must be unique across categories."
                      },
                      name: localized_name_schema,
                      type: {
                        type: "string",
                        description: "Always \"other\" for custom categories. Ignored for system categories."
                      }
                    }
                  }
                },
                ledgers: {
                  type: "array",
                  minItems: 1,
                  items: {
                    type: "object",
                    required: [ "category", "code", "name", "unexpected_balance", "is_monetary" ],
                    additionalProperties: false,
                    properties: {
                      category: {
                        type: "string",
                        description: "Category reference: a system identifier (\"CA\", ...) or a custom category's code."
                      },
                      code: {
                        type: "string",
                        description: "Ledger code suffix. Its length must match ledger_length. Must be unique within the category."
                      },
                      name: localized_name_schema,
                      unexpected_balance: {
                        type: "string",
                        enum: %w[accept warn disallow]
                      },
                      is_monetary: {
                        type: "boolean",
                        description: "Only allowed to be true for CA, LA, CL, LL, OE categories."
                      }
                    }
                  }
                },
                accounts: {
                  type: "array",
                  minItems: 1,
                  items: {
                    type: "object",
                    required: [ "ledger", "code", "name", "accepts_other_currencies" ],
                    additionalProperties: false,
                    properties: {
                      ledger: {
                        type: "string",
                        description: "Ledger reference as \"<category_ref>.<ledger_code>\"."
                      },
                      code: {
                        type: "string",
                        description: "Account code suffix. Its length must match account_length. Must be unique within the ledger."
                      },
                      name: localized_name_schema,
                      accepts_other_currencies: { type: "boolean" }
                    }
                  }
                }
              }
            }
          }
        }
      end

      # i18n map of locale → string. The locale keys the AI is told to
      # use come from the ContextBuilder (so the model doesn't have to
      # guess which locales are active).
      def self.localized_name_schema
        {
          type: "object",
          description: "Map of locale code → translated name. Must include at least the organization's primary locale.",
          additionalProperties: { type: "string" }
        }
      end

      # Convenience accessor for the function name only — used by the
      # service to match the tool call the model returns.
      def self.name
        TOOL_NAME
      end
    end
  end
end
