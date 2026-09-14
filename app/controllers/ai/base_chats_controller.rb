# frozen_string_literal: true

module Ai
  # Abstract base for every AI chat controller in the app.
  #
  # Owns the mechanism that must not be duplicated per feature:
  #   - authorization gate (current_organization :administrate?)
  #   - member-scoped chat lookup — the security-critical piece
  #   - find-or-create open chat
  #   - calling the feature's service
  #   - availability gating on chat creation only
  #
  # Does NOT own policy that varies per feature:
  #   - which `kind` this controller serves
  #   - which service to invoke
  #   - what makes the feature "available" for an organization
  #   - how to serialize chat and post_message responses
  #   - any feature-specific actions (accept, apply, etc.)
  #
  # Subclasses must implement the hooks below. Not routed directly.
  class BaseChatsController < ApplicationController
    before_action :authorize_org
    before_action :load_chat, only: [ :show, :post_message, :abandon, :accept ]
    before_action :check_availability, only: [ :create ]

    def create
      chat = find_or_create_open_chat
      render json: chat_payload(chat), status: :ok
    end

    def show
      render json: chat_payload(@chat), status: :ok
    end

    def post_message
      content = params[:content].to_s

      if content.strip.empty?
        render json: { errors: [ "content must not be blank" ] }, status: :unprocessable_content
        return
      end

      result = run_service(@chat, content)

      render json: post_message_payload(@chat.reload, result), status: :ok
    end

    def abandon
      @chat.abandon!
      render json: chat_payload(@chat), status: :ok
    end

    private

    # ── Subclass hooks ─────────────────────────────────────────────────

    def chat_kind
      raise NotImplementedError, "#{self.class} must implement #chat_kind"
    end

    def service_class
      raise NotImplementedError, "#{self.class} must implement #service_class"
    end

    def availability_ok?(_organization)
      true
    end

    def chat_payload(chat)
      raise NotImplementedError, "#{self.class} must implement #chat_payload"
    end

    def post_message_payload(chat, result)
      raise NotImplementedError, "#{self.class} must implement #post_message_payload"
    end

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

    def run_service(chat, content)
      service_class.call(chat: chat, user_content: content)
    end
  end
end
