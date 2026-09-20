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

  # Upper bound on how many messages are shipped to the client in a
  # single payload. The DB keeps the full transcript; the wire carries
  # only the most recent MAX_PAYLOAD_MESSAGES, plus a total count so the
  # client can render "N older messages not shown" if it wants to.
  #
  # Chosen to cover virtually every real chat (a chart-of-accounts
  # conversation is typically a handful of turns; 50 is generous). Real
  # pagination is a follow-up if a feature ever routinely exceeds this.
  MAX_PAYLOAD_MESSAGES = 50

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

  def processing?
    state["processing"] == true
  end

  def start_processing!
    update!(
      state: state.merge(
        "processing"             => true,
        "processing_started_at"  => Time.current.iso8601,
        "processing_finished_at" => nil
      )
    )
    broadcast_change(:processing_started)
  end

  def finish_processing!
    update!(
      state: state.merge(
        "processing"             => false,
        "processing_finished_at" => Time.current.iso8601
      )
    )
    broadcast_change(:processing_finished)
  end

  # ── Messages ────────────────────────────────────────────────────────

  def append_message!(role:, content:, sender_member: nil, metadata: {})
    messages.create!(
      role: role,
      content: content,
      sender_member: sender_member,
      metadata: metadata
    ).tap do
      update_column(:last_message_at, Time.current)
      broadcast_change(:message_created)
    end
  end

  private

  # Fire-and-forget cable signal. A broadcast failure must NEVER roll
  # back or fail the caller: the message (or state change) is already
  # persisted, and polling will catch up within its fallback interval.
  #
  # We log and swallow. If this ever needs to be more than best-effort,
  # the right shape is an after-commit hook with a retry queue — not a
  # synchronous raise.
  def broadcast_change(reason)
    AiChatChannel.signal(self, reason: reason)
  rescue StandardError => e
    Rails.logger.warn(
      "[AiChat##{reason}] broadcast failed for chat=#{id}: #{e.class}: #{e.message}"
    )
  end
end