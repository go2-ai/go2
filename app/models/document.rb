class Document < ApplicationRecord
  belongs_to :organization
  belongs_to :documentable, polymorphic: true
  belongs_to :member, optional: true

  has_one_attached :attachment

  SAFE_CONTENT_TYPES = %w[
    image/png
    image/jpeg
    image/gif
    image/webp
    application/pdf
    text/plain
    text/csv
    application/json
  ].freeze

  validate :attachment_presence
  validate :attachment_content_type_allowed
  validate :attachment_size_within_limit
  validate :organization_total_file_size_not_exceeded

  after_create :increment_organization_total_file_size
  after_destroy :decrement_organization_total_file_size

  delegate :byte_size, to: :attachment, prefix: true, allow_nil: true

  def previewable?
    attachment.content_type.in?(%w[image/png image/jpeg image/gif image/webp application/pdf text/plain])
  end

  def display_name
    attachment.filename.to_s
  end

  def uploaded_by
    member&.name
  end

  private

  def attachment_presence
    errors.add(:attachment, "must be attached") unless attachment.attached?
  end

  def attachment_content_type_allowed
    return unless attachment.attached?
    return if SAFE_CONTENT_TYPES.include?(attachment.content_type)

    errors.add(:attachment, "has an unsupported file type")
  end

  def attachment_size_within_limit
    return unless attachment.attached?
    max_bytes = organization.max_file_size.megabytes

    if attachment.byte_size > max_bytes
      errors.add(:attachment, "exceeds the maximum file size of #{organization.max_file_size} MB")
    end
  end

  def organization_total_file_size_not_exceeded
    return unless attachment.attached?

    current_total = organization.total_file_size.to_i
    new_total = current_total + attachment.byte_size
    max_total_bytes = organization.max_total_file_size.megabytes

    if new_total > max_total_bytes
      errors.add(:attachment, "would exceed the organization's total storage limit of #{organization.max_total_file_size} MB")
    end
  end

  def increment_organization_total_file_size
    organization.increment!(:total_file_size, attachment.byte_size)
  end

  def decrement_organization_total_file_size
    organization.decrement!(:total_file_size, attachment.byte_size)
  end
end
