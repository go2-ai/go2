# frozen_string_literal: true

module Accounting
  module ChartOfAccountsAi
    # HTTP entry point for the chart-of-accounts AI chat.
    #
    # Inherits all shared mechanics from Ai::BaseChatsController; this
    # class only declares:
    #   - the chat kind ("chart_of_accounts")
    #   - the service class to run
    #   - the availability rule for creating a new chat
    #   - the response shapes
    #   - the accept action (which is domain-specific, not shared)
    #
    # #post_message is asynchronous: it persists the user message, moves
    # any files the client uploaded under the chat onto that message,
    # enqueues ProcessMessageJob, and returns 202 Accepted. The client
    # polls GET /chats/:id until chat.state["processing"] is false.
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

      def post_message
        content = params[:content].to_s

        if content.strip.empty?
          render json: { errors: [ "content must not be blank" ] }, status: :unprocessable_content
          return
        end

        if @chat.processing?
          render json: { errors: [ "chat is already processing a message" ] }, status: :conflict
          return
        end

        user_message = nil

        ActiveRecord::Base.transaction do
          user_message = @chat.append_message!(
            role: "user",
            content: content,
            sender_member: current_member
          )
          reparent_attachments_to(user_message)
          @chat.start_processing!   # ← NEW: flip the flag before responding
        end

        ProcessMessageJob.perform_later(@chat.id, user_message.id)

        render json: {
          status: "processing",
          user_message_id: user_message.id,
          chat: chat_payload(@chat.reload)
        }, status: :accepted
      end

      private

      def chat_kind
        "chart_of_accounts"
      end

      def service_class
        Accounting::ChartOfAccountsAi::Service
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

      # Moves the requested Documents from this chat to the given user
      # message. The client uploads files first (documentable_type:
      # "AiChat", documentable_id: chat.id), then posts a message with
      # attachment_ids. Ids that don't belong to this chat, or don't
      # exist, are silently skipped — the message still sends.
      def reparent_attachments_to(user_message)
        ids = Array(params[:attachment_ids]).map(&:to_i).reject(&:zero?)
        return if ids.empty?

        documents = @chat.documents.where(id: ids)

        documents.find_each do |document|
          document.update!(
            documentable_type: "AiMessage",
            documentable_id: user_message.id
          )
        end
      end
    end
  end
end
