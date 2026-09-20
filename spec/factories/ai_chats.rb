# frozen_string_literal: true

FactoryBot.define do
  factory :ai_chat do
    organization { Organization.first || create(:organization) }
    member { create(:member, organization: organization) }
    kind { "chart_of_accounts" }
    status { "open" }
    state { {} }
    subject { nil }

    trait :accepted do
      status { "accepted" }
    end

    trait :abandoned do
      status { "abandoned" }
      abandoned_at { Time.current }
    end

    trait :with_messages do
      transient do
        message_count { 3 }
      end

      after(:create) do |chat, evaluator|
        evaluator.message_count.times do |i|
          role = i.even? ? "user" : "assistant"
          create(
            :ai_message,
            ai_chat: chat,
            role: role,
            sender_member: role == "user" ? chat.member : nil,
            content: "message #{i + 1}"
          )
        end
        chat.update_column(:last_message_at, Time.current)
      end
    end
  end
end
