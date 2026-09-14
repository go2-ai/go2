# frozen_string_literal: true

class AiMessageBlueprint < Blueprinter::Base
  identifier :id

  fields :role, :content, :metadata, :created_at

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
end
