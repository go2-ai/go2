# frozen_string_literal: true

# A conversation session between a member and the AI, scoped to an
# organization and typed by `kind`. Generic across AI features — see
# AiMessage for the payload model.
#
# Owner is always a Member, never a User. Users are deletable; Members are
# durable. Any AI record that outlives a user's account must reference the
# Member, not the User.
class AiChat < ApplicationRecord
  # The set of feature "kinds" the app understands. Adding a new AI feature
  # means adding a kind here and a corresponding handler in the service layer.
  KINDS = %w[
    chart_of_accounts
  ].freeze

  STATUSES = %w[open accepted abandoned].freeze

  belongs_to :organization
  belongs_to :member

  belongs_to :subject, polymorphic: true, optional: true

  has_many :messages,
           class_name: "AiMessage",
           dependent: :destroy,
           inverse_of: :ai_chat

  has_many :documents, as: :documentable, dependent: :destroy

  validates :kind, presence: true, inclusion: { in: KINDS }
  validates :status, presence: true, inclusion: { in: STATUSES }

  scope :open, -> { where(status: "open") }
  scope :accepted, -> { where(status: "accepted") }
  scope :abandoned, -> { where(status: "abandoned") }
  scope :for_kind, ->(kind) { where(kind: kind) }
  scope :recent_first, -> { order(last_message_at: :desc, created_at: :desc) }

  def open? = status == "open"
  def accepted? = status == "accepted"
  def abandoned? = status == "abandoned"

  def accept!
    update!(status: "accepted")
  end

  def abandon!
    update!(status: "abandoned", abandoned_at: Time.current)
  end

  # ── Processing state ────────────────────────────────────────────────
  #
  # While an async job is handling a message for this chat, we mark the
  # chat as "processing" so the frontend can poll GET /chats/:id and
  # render a "thinking..." indicator until the job finishes.
  #
  # Stored in the state jsonb rather than a dedicated column because it's
  # transient ephemeral metadata, not a domain attribute of the chat.
  def processing?
    state["processing"] == true
  end

  def start_processing!
    update!(
      state: state.merge(
        "processing" => true,
        "processing_started_at" => Time.current.iso8601
      )
    )
  end

  def finish_processing!
    # Explicitly set to false rather than delete the key, so the frontend
    # can distinguish "never started" (key absent) from "just finished"
    # (key == false).
    update!(
      state: state.merge(
        "processing" => false,
        "processing_finished_at" => Time.current.iso8601
      )
    )
  end

  # Appends a message and bumps last_message_at. This is the only sanctioned
  # way to add to a chat — going through the association directly won't
  # update the timestamp.
  def append_message!(role:, content:, sender_member: nil, metadata: {})
    messages.create!(
      role: role,
      content: content,
      sender_member: sender_member,
      metadata: metadata
    ).tap do
      update_column(:last_message_at, Time.current)
    end
  end
end
