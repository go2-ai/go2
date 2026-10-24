module Accounting
  module StatementMappingAi
    # The final tool: the assistant's proposal of rule changes.
    module ToolSchema
      TOOL_NAME = "propose_mapping_rules".freeze

      module_function

      def definition
        {
          type: "function",
          function: {
            name: TOOL_NAME,
            description: "Proposes changes to the statement's mapping rules. The user reviews every change " \
                         "with a preview of the statement and accepts the ones they want.",
            parameters: {
              type: "object",
              required: %w[summary changes],
              properties: {
                summary: { type: "string", description: "What the changes do, in the user's language" },
                changes: {
                  type: "array",
                  items: {
                    type: "object",
                    required: %w[action reason confidence],
                    properties: {
                      action: { type: "string", enum: %w[add update remove] },
                      rule_number: { type: "integer", description: "update/remove: the rule's number" },
                      line_key: { type: "string", description: "Key of the line the balances go to (not a heading)" },
                      selector_type: { type: "string", enum: %w[category ledger account account_range profit_or_loss] },
                      selector: {
                        type: "object",
                        description: "category: identifiers; ledger: ledger_codes; account: account_codes and/or " \
                                     "settings; account_range: from/to (prefixes of full codes, same length); " \
                                     "profit_or_loss: period (current | prior)",
                        properties: {
                          identifiers: { type: "array", items: { type: "string" } },
                          ledger_codes: { type: "array", items: { type: "string" } },
                          account_codes: { type: "array", items: { type: "string" } },
                          settings: { type: "array", items: { type: "string",
                                                              enum: Accounting::StatementMappingRule::SETTING_ACCOUNTS } },
                          from: { type: "string" },
                          to: { type: "string" },
                          period: { type: "string", enum: %w[current prior] }
                        }
                      },
                      opposite_line_key: { type: "string", description: "Line for balances on the opposite side" },
                      grain: { type: "string", description: "Where the side is judged: account, account_currency, " \
                                                            "account_center1..6, row" },
                      measure: { type: "string", enum: Accounting::StatementMappingRule::MEASURES },
                      center_level: { type: "integer" },
                      center_codes: { type: "array", items: { type: "string" } },
                      center_type_names: { type: "array", items: { type: "string" } },
                      currencies: { type: "array", items: { type: "string" } },
                      priority: { type: "integer", description: "Only to override the most-specific-wins order" },
                      reason: { type: "string", description: "Why, in the user's language" },
                      confidence: { type: "number", description: "0 to 1" }
                    }
                  }
                }
              }
            }
          }
        }
      end
    end
  end
end
