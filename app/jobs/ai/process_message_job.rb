# frozen_string_literal: true

module Ai
  # Base class for AI-feature jobs that process a single user message
  # asynchronously. Owns the full job lifecycle:
  #
  #   - load the chat and the user message
  #   - mark the chat as "processing" so the frontend can poll
  #   - extract text from any documents attached to the user message
  #     and prepend it to the user content
  #   - invoke the feature's service (see `service_class`)
  #   - on any StandardError: write a user-visible fallback assistant
  #     message and re-raise so Solid Queue records the failure
  #   - in an `ensure`: always clear the "processing" flag
  #
  # What the subclass supplies:
  #   - which service class to call (`service_class`)
  #   - the fallback message text (`fallback_message`)
  #   - any extra metadata for the fallback (`fallback_metadata`)
  #
  # Concurrency is serialized per chat: `limits_concurrency` uses
  # `concurrency_key_for(chat_id)` so two rapid messages on the same
  # chat queue behind each other rather than racing. Override that
  # method if a future feature needs a different key.
  #
  # NOTE on `limits_concurrency`: Solid Queue evaluates the `key:` lambda
  # with the job *instance* as `self` (via instance_exec-style eval), so
  # the lambda body must call an INSTANCE method — not a class method.
  # `concurrency_key_for` is therefore defined as an instance method
  # below. A bare `concurrency_key_for(...)` inside the lambda resolves
  # against that instance and works; a `self.concurrency_key_for(...)`
  # would fail because the method isn't on the class.
  #
  # The job does NOT retry on transient errors — the service layer
  # already handles network/429/5xx retries internally. A re-raised
  # error here means something structural went wrong and should
  # surface in the queue's failure log.
  class ProcessMessageJob < ApplicationJob
    queue_as :default

    limits_concurrency to: 1, key: ->(chat_id, _user_message_id) { concurrency_key_for(chat_id) }

    def perform(chat_id, user_message_id)
      chat         = AiChat.find(chat_id)
      user_message = AiMessage.find(user_message_id)

      chat.start_processing!

      begin
        extracted        = extract_attachments(user_message)
        combined_content = combine_content(user_message.content, extracted)

        service_class.call(
          chat:                 chat,
          user_content:         combined_content,
          persist_user_message: false
        )
      rescue StandardError => e
        Rails.logger.error(
          "[#{self.class.name}] chat=#{chat_id} " \
          "user_message=#{user_message_id} failed: #{e.class}: #{e.message}"
        )

        chat.append_message!(
          role:     "assistant",
          content:  fallback_message,
          metadata: fallback_metadata(e)
        )

        raise
      ensure
        chat.finish_processing!
      end
    end

    private

    # ── Concurrency key ─────────────────────────────────────────────────
    #
    # Referenced from the `limits_concurrency` lambda above. Must be an
    # INSTANCE method (see the class-level note) so the lambda's bare
    # call resolves correctly. Subclasses may override it to derive a
    # different concurrency key.
    def concurrency_key_for(chat_id)
      chat_id.to_s
    end

    # ── Subclass hooks ──────────────────────────────────────────────────

    # The feature service to invoke. Must respond to
    # `.call(chat:, user_content:, persist_user_message:)`.
    def service_class
      raise NotImplementedError, "#{self.class} must implement #service_class"
    end

    # User-visible text shown when the job failed unexpectedly.
    def fallback_message
      "I couldn't complete this request — please try again."
    end

    # Metadata attached to the fallback assistant message. The base
    # always records `error => true` and the failing class; subclasses
    # can merge in feature-specific keys.
    def fallback_metadata(error)
      {
        "error"       => true,
        "error_class" => error.class.name
      }
    end

    # ── Attachment handling ─────────────────────────────────────────────

    # Reads every document attached to the user message, extracts its
    # text (PDF, XLSX, CSV, JSON, TXT), and returns an array of hashes:
    #
    #   [
    #     { "filename" => "trial_balance.xlsx", "kind" => "xlsx", "text" => "...", "error" => nil },
    #     ...
    #   ]
    #
    # Also writes the array back to user_message.metadata["extracted_files"]
    # so the frontend can show what was read. DocumentTextExtractor never
    # raises on malformed input — a failed extraction comes back as a
    # Result with #error set, which is recorded per-file.
    def extract_attachments(user_message)
      documents = Document.where(
        documentable_type: "AiMessage",
        documentable_id:   user_message.id
      ).with_attached_attachment

      return [] if documents.empty?

      extracted = documents.map do |document|
        attachment = document.attachment
        result     = DocumentTextExtractor.call(attachment: attachment)

        {
          "filename" => attachment.filename.to_s,
          "kind"     => result.kind.to_s,
          "text"     => result.text,
          "error"    => result.error
        }
      end

      user_message.update!(
        metadata: user_message.metadata.merge("extracted_files" => extracted)
      )

      extracted
    end

    # Prepends each file's extracted text to the user content so the
    # LLM sees the files as additional context. If a file failed to
    # extract, a short note is added instead of the text.
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