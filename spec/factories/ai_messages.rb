# frozen_string_literal: true

FactoryBot.define do
  factory :ai_message do
    ai_chat
    role { "user" }
    content { "Hello, world" }
    sender_member { role == "user" ? ai_chat.member : nil }
    metadata { {} }

    trait :from_assistant do
      role { "assistant" }
      sender_member { nil }
    end

    trait :from_tool do
      role { "tool" }
      sender_member { nil }
      metadata { { "tool" => "propose_chart_of_accounts" } }
    end
  end
end
