# frozen_string_literal: true

module Accounting
  module ChartOfAccountsAi
    # Handles a single user message asynchronously via Solid Queue.
    #
    # The controller enqueues this job from ChatsController#post_message,
    # immediately returns 202 Accepted to the client, and the client
    # polls GET /chats/:id until the chat is no longer processing.
    #
    # Concurrency control ensures only one job runs per chat at a time —
    # two rapid messages on the same chat are serialized rather than
    # racing each other. The job's execution is idempotent at the domain
    # level: the service persists messages incrementally and the
    # state["processing"] flag is cleared on both success and failure.
    #
    # Design decisions:
    #   - The job does NOT retry on transient errors. The service layer
    #     already has its own retry-with-backoff for network / 429 / 5xx.
    #   - On an unhandled exception, the job writes a user-visible fallback
    #     message and re-raises so Solid Queue records the failure.
    #   - File extraction runs INSIDE the job (before the service call),
    #     so OCR-class operations never block the HTTP request.
    class ProcessMessageJob < ApplicationJob
      queue_as :default

      limits_concurrency to: 1, key: ->(chat_id, _user_message_id) { chat_id.to_s }

      def perform(chat_id, user_message_id)
        chat = AiChat.find(chat_id)
        user_message = AiMessage.find(user_message_id)

        chat.start_processing!

        begin
          extracted = extract_attachments(user_message)
          combined_content = combine_content(user_message.content, extracted)

          Accounting::ChartOfAccountsAi::Service.call(
            chat: chat,
            user_content: combined_content,
            persist_user_message: false
          )
        rescue StandardError => e
          Rails.logger.error(
            "[ChartOfAccountsAi::ProcessMessageJob] chat=#{chat_id} " \
            "user_message=#{user_message_id} failed: #{e.class}: #{e.message}"
          )

          chat.append_message!(
            role: "assistant",
            content: "I couldn't complete this request — please try again.",
            metadata: {
              "error" => true,
              "error_class" => e.class.name
            }
          )

          raise
        ensure
          chat.finish_processing!
        end
      end

      private

      # Reads every document attached to the user message, extracts its
      # text (PDF, XLSX, CSV, JSON, TXT), and returns an array of hashes:
      #
      #   [
      #     { "filename" => "trial_balance.xlsx", "kind" => "xlsx", "text" => "...", "error" => nil },
      #     ...
      #   ]
      #
      # Also writes the array back to user_message.metadata["extracted_files"]
      # so the frontend can show what was read.
      def extract_attachments(user_message)
        documents = Document.where(
          documentable_type: "AiMessage",
          documentable_id: user_message.id
        ).with_attached_attachment
        return [] if documents.empty?

        extracted = documents.map do |document|
          attachment = document.attachment
          result = DocumentTextExtractor.call(attachment: attachment)

          {
            "filename" => attachment.filename.to_s,
            "kind"     => result.kind.to_s,
            "text"     => result.text,
            "error"    => result.error
          }
        end

        # Persist what we extracted so it's part of the audit trail.
        user_message.update!(
          metadata: user_message.metadata.merge("extracted_files" => extracted)
        )

        extracted
      end

      # Prepends each file's extracted text to the user content so the
      # LLM sees the files as additional context. If a file failed to
      # extract, we add a short note instead of the text.
      def combine_content(user_content, extracted)
        return user_content if extracted.empty?

        file_blocks = extracted.map do |item|
          if item["text"].present?
            "=== File: #{item['filename']} ===\n#{item['text']}"
          else
            "=== File: #{item['filename']} ===\n(#{item['error'] || 'no text extracted'})"
          end
        end

        "#{file_blocks.join("\n\n")}\n\n---\n\n#{user_content}"
      end
    end
  end
end
