# frozen_string_literal: true

require "rails_helper"

RSpec.describe G2::TrialExpiryJob, type: :job do
  include ActiveJob::TestHelper

  let(:org) { create(:organization, is_tenant: true, is_trial: true) }
  let(:admin) { create(:user, email: "admin@example.com") }

  before do
    create(:member, organization: org, user: admin)
    create(:permission, code: Permission::ORG_ADMIN, organization: org, grantee: org.members.first)
  end

  describe "#perform" do
    it "emails admins when trial ends in 3 days" do
      org.update!(created_at: Date.current + 3.days - G2::TRIAL_PERIOD)

      expect {
        perform_enqueued_jobs { described_class.perform_now }
      }.to change { ActionMailer::Base.deliveries.count }.by(1)

      mail = ActionMailer::Base.deliveries.last
      expect(mail.subject).to eq("Your trial ends in 3 days")
      expect(mail.to).to include("admin@example.com")
    end

    it "emails admins when trial ends in 1 day" do
      org.update!(created_at: Date.current + 1.day - G2::TRIAL_PERIOD)

      expect {
        perform_enqueued_jobs { described_class.perform_now }
      }.to change { ActionMailer::Base.deliveries.count }.by(1)

      mail = ActionMailer::Base.deliveries.last
      expect(mail.subject).to eq("Your trial ends in 1 day")
    end

    it "does not email orgs whose trial is not ending in the warning windows" do
      org.update!(created_at: Date.current - G2::TRIAL_PERIOD)

      expect {
        perform_enqueued_jobs { described_class.perform_now }
      }.not_to(change { ActionMailer::Base.deliveries.count })
    end

    it "only emails org admins, not regular members" do
      org.update!(created_at: Date.current + 3.days - G2::TRIAL_PERIOD)

      regular_user = create(:user, email: "regular@example.com")
      create(:member, organization: org, user: regular_user)

      expect {
        perform_enqueued_jobs { described_class.perform_now }
      }.to change { ActionMailer::Base.deliveries.count }.by(1)

      mail = ActionMailer::Base.deliveries.last
      expect(mail.to).to contain_exactly("admin@example.com")
      expect(mail.to).not_to include("regular@example.com")
    end
  end
end