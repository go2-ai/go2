# frozen_string_literal: true

module Accounting
  module ChartOfAccountsAi
    # HTTP entry point for the chart-of-accounts AI chat.
    #
    # Inherits the async chat protocol from Ai::BaseChatsController:
    # POST /chats, GET /chats/:id, POST /chats/:id/messages (202),
    # POST /chats/:id/abandon.
    #
    # Declares only the chart-specific facts:
    #   - chat_kind  ("chart_of_accounts")
    #   - the availability rule for creating a new chat
    #   - the job that processes a user message
    #   - chat serialization
    #   - the one domain-specific action: accepting a proposal
    #
    # #accept is chart-specific — it persists the current proposal into
    # the organization's chart of accounts. It lives here, not in the
    # base, because "accept" means different things (or nothing) to
    # other features.
    class ChatsController < Ai::BaseChatsController
      # Accepts the current proposal in the chat's state: persists it
      # into the organization's chart of accounts in a transaction.
      def accept
        if @chat.status == "accepted"
          render json: { errors: [ "chat is already accepted" ] }, status: :conflict
          return
        end

        result = ApplyProposal.call(chat: @chat)

        if result.success?
          render json: {
            chat:  AiChatBlueprint.render_as_hash(result.chat),
            chart: result.chart
          }, status: :ok
        else
          render json: {
            errors: result.errors,
            chat:   AiChatBlueprint.render_as_hash(result.chat)
          }, status: :unprocessable_content
        end
      end

      private

      def chat_kind
        "chart_of_accounts"
      end

      def job_class
        Accounting::ChartOfAccountsAi::ProcessMessageJob
      end

      # The chart-of-accounts assistant is only usable when:
      #   1. the org is NOT inheriting its parent's chart, and
      #   2. the org's chart is currently empty (no user-created ledgers).
      #
      # Once a chat exists, this rule is not re-checked — a user should
      # always be able to finish or abandon a session they already started.
      def availability_ok?(organization)
        return false if organization.accounting_setting&.use_parent_org_accounts

        !organization.account_categories.joins(:ledgers).exists?
      end

      def chat_payload(chat)
        AiChatBlueprint.render_as_hash(chat, view: :with_messages)
      end
    end
  end
end