# frozen_string_literal: true

module Ai
  # Abstract base for every AI chat controller in the app.
  #
  # The AI chat protocol is asynchronous by design:
  #
  #   POST   /chats              — find or create the member's open chat
  #   GET    /chats/:id          — poll the chat's current state
  #   POST   /chats/:id/messages — persist the user message, enqueue a
  #                                background job, return 202 Accepted.
  #                                The client polls GET /chats/:id until
  #                                chat.state["processing"] is false.
  #   POST   /chats/:id/abandon  — mark the chat abandoned
  #
  # All four actions are implemented here. Subclasses declare only the
  # feature-specific facts:
  #
  #   - `chat_kind`             — the discriminator stored on AiChat.kind
  #   - `availability_ok?(org)` — gate for creating a new chat
  #   - `job_class`             — the job that processes a user message
  #   - `chat_payload(chat)`    — serialization of a chat to JSON
  #
  # Feature-specific actions that don't fit this protocol (e.g. "accept
  # the current proposal") are declared on the subclass and may use the
  # shared `load_chat` / `chat_payload` helpers.
  #
  # The base does NOT know how the feature's service is invoked — that
  # is the job's responsibility (see Ai::ProcessMessageJob). A feature
  # therefore declares its `service_class` once, on its job subclass.
  class BaseChatsController < ApplicationController
    before_action :authorize_org
    before_action :load_chat, only: [ :show, :post_message, :abandon, :accept ]
    before_action :check_availability, only: [ :create ]

    # ── Actions ─────────────────────────────────────────────────────────

    def create
      chat = find_or_create_open_chat
      render json: chat_payload(chat), status: :ok
    end

    def show
      render json: chat_payload(@chat), status: :ok
    end

    # Async message submission. Persists the user message (and reparents
    # any uploads under it), flips the chat into "processing", enqueues
    # the feature's job, and returns 202 Accepted. The client then polls
    # GET /chats/:id until `state["processing"]` is false.
    #
    # Rejects:
    #   - blank content (422)
    #   - a chat that is already processing (409)
    #
    # NOTE: the "already processing" guard is an HTTP-level convenience,
    # not a hard concurrency control. Two simultaneous POSTs can both
    # pass the check before either commits `start_processing!`. The job's
    # `limits_concurrency` serializes execution, but both user messages
    # are still persisted. The frontend disables the send button while
    # processing, which is what keeps this from mattering in practice.
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
          role:          "user",
          content:       content,
          sender_member: current_member
        )
        reparent_attachments_to(user_message)
        @chat.start_processing!
      end

      job_class.perform_later(@chat.id, user_message.id)

      render json: post_message_response(@chat.reload, user_message), status: :accepted
    end

    def abandon
      @chat.abandon!
      render json: chat_payload(@chat), status: :ok
    end

    # ── Subclass hooks ──────────────────────────────────────────────────

    # The feature discriminator stored on AiChat.kind.
    def chat_kind
      raise NotImplementedError, "#{self.class} must implement #chat_kind"
    end

    # Gate for creating a new chat. Defaults to "always available" so a
    # feature that has no state precondition doesn't have to override.
    def availability_ok?(_organization)
      true
    end

    # The job enqueued by #post_message. Each feature has its own job
    # subclass (typically a thin wrapper around Ai::ProcessMessageJob)
    # that names its service class and fallback message.
    def job_class
      raise NotImplementedError, "#{self.class} must implement #job_class"
    end

    # Serialization of a chat to JSON. Must return a Hash. Subclasses
    # typically delegate to their feature Blueprint, and usually use a
    # view that includes messages.
    def chat_payload(_chat)
      raise NotImplementedError, "#{self.class} must implement #chat_payload"
    end

    # The 202 response body for #post_message. Subclasses override only
    # if they need to add feature-specific keys to the envelope.
    def post_message_response(chat, user_message)
      {
        status:          "processing",
        user_message_id: user_message.id,
        chat:            chat_payload(chat)
      }
    end

    private

    # ── Shared behavior ────────────────────────────────────────────────

    def authorize_org
      authorize current_organization, :administrate?
    end

    def load_chat
      @chat = current_member
                .ai_chats
                .where(kind: chat_kind)
                .find(params[:id])
    end

    def check_availability
      return if availability_ok?(current_organization)

      render json: {
        errors: [ "This AI feature is not available for the current organization state." ]
      }, status: :forbidden
    end

    def find_or_create_open_chat
      current_member.ai_chats.where(kind: chat_kind, status: "open").order(:id).first ||
        create_open_chat_safely
    end

    def create_open_chat_safely
      current_member.ai_chats.create!(organization: current_organization, kind: chat_kind)
    rescue ActiveRecord::RecordNotUnique
      current_member.ai_chats.where(kind: chat_kind, status: "open").order(:id).first!
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
          documentable_id:   user_message.id
        )
      end
    end
  end
end