# frozen_string_literal: true

class AiMessage < ApplicationRecord
  ROLES = %w[user assistant tool].freeze

  belongs_to :ai_chat, inverse_of: :messages
  belongs_to :sender_member, class_name: "Member", optional: true

  has_many :documents,
           as: :documentable,
           dependent: :destroy

  validates :role, presence: true, inclusion: { in: ROLES }
  validates :content, presence: true
  validate  :sender_consistency

  scope :chronological, -> { order(:created_at, :id) }
  scope :from_user, -> { where(role: "user") }
  scope :from_assistant, -> { where(role: "assistant") }

  def sender_consistency
    return if role == "user"

    if sender_member_id.present?
      errors.add(:sender_member, "must be blank for #{role} messages")
    end
  end
end
