# frozen_string_literal: true

class AiMessageBlueprint < Blueprinter::Base
  identifier :id

  fields :role, :content, :created_at

  # metadata is exposed but with the bulk stripped:
  #
  #   - usage.raw (the full provider response body) is dropped — it can
  #     be hundreds of bytes per message, is never rendered, and lives
  #     in the DB if anyone needs it for debugging.
  #   - extracted_files[].text (the full text of an attached file) is
  #     dropped for the same reason; the filename and error stay so the
  #     client can still show "we read X" / "X failed".
  #
  # Everything else passes through unchanged.
  field :metadata do |message|
    slim_metadata(message.metadata)
  end

  field :sender do |message|
    member = message.sender_member
    next nil unless member

    {
      id:      member.id,
      name:    member.name,
      initial: member.initial,
      color:   member.color
    }
  end

  def self.slim_metadata(metadata)
    return {} if metadata.blank?

    slim = metadata.deep_dup

    if slim["usage"].is_a?(Hash)
      slim["usage"] = slim["usage"].except("raw")
    end

    if slim["extracted_files"].is_a?(Array)
      slim["extracted_files"] = slim["extracted_files"].map do |file|
        file.except("text")
      end
    end

    slim
  end
end