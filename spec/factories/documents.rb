FactoryBot.define do
  factory :document do
    organization { Organization.first || create(:organization) }
    documentable { create(:accounting_journal_entry, organization: organization) }
    member { create(:member, organization: organization) }

    after(:build) do |document|
      document.attachment.attach(
        io: StringIO.new("test content"),
        filename: "test.txt",
        content_type: "text/plain"
      )
    end
  end
end
