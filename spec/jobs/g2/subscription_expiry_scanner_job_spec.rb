# frozen_string_literal: true

require "rails_helper"

RSpec.describe G2::SubscriptionExpiryScannerJob, type: :job do
  include ActiveJob::TestHelper

  let(:org) { create(:organization, is_tenant: true, is_trial: false) }
  let(:admin) { create(:user, email: "admin@example.com") }

  before do
    create(:member, organization: org, user: admin)
    create(:permission, code: Permission::ORG_ADMIN, organization: org, grantee: org.members.first)
    G2::Price.replace!("accounting", "level_1", "monthly", 2500)
  end

  describe "warning emails for ending subscriptions" do
    it "emails when subscription ends in 3 days" do
      create_subscription(ends_at: 3.days.from_now, status: "active")

      expect {
        perform_enqueued_jobs { described_class.perform_now }
      }.to change { ActionMailer::Base.deliveries.count }.by(1)

      mail = ActionMailer::Base.deliveries.last
      expect(mail.subject).to include("ends in 3 days")
    end

    it "emails when subscription ends in 1 day" do
      create_subscription(ends_at: 1.day.from_now, status: "active")

      expect {
        perform_enqueued_jobs { described_class.perform_now }
      }.to change { ActionMailer::Base.deliveries.count }.by(1)

      mail = ActionMailer::Base.deliveries.last
      expect(mail.subject).to include("ends in 1 day")
    end

    it "does not email for subscriptions ending outside warning windows" do
      create_subscription(ends_at: 5.days.from_now, status: "active")

      expect {
        perform_enqueued_jobs { described_class.perform_now }
      }.not_to(change { ActionMailer::Base.deliveries.count })
    end
  end

  describe "auto-renewal" do
    it "creates a renewal invoice when auto_renew is true and subscription has lapsed" do
      create_subscription(ends_at: 1.day.ago, status: "active", auto_renew: true)

      expect {
        perform_enqueued_jobs { described_class.perform_now }
      }.to change { G2::Invoice.count }.by(1)
    end

    it "does not auto-renew when auto_renew is false" do
      create_subscription(ends_at: 1.day.ago, status: "active", auto_renew: false)

      expect {
        perform_enqueued_jobs { described_class.perform_now }
      }.not_to(change { G2::Invoice.count })
    end

    it "notifies admins if auto-renewal fails" do
      create_subscription(ends_at: 1.day.ago, status: "active", auto_renew: true)
      allow(G2::Invoice).to receive(:create_for_renewal!).and_raise(StandardError, "failed")

      expect {
        perform_enqueued_jobs { described_class.perform_now }
      }.to change { ActionMailer::Base.deliveries.count }.by(1)

      mail = ActionMailer::Base.deliveries.last
      expect(mail.subject).to include("Auto-renewal failed")
    end
  end

  describe "grace period warnings" do
    it "emails when cancelled subscription is nearing end of grace period" do
      # ends_at set such that grace period (ends_at + GRACE_PERIOD) ends in 3 days
      ends_at = 3.days.from_now - G2::GRACE_PERIOD
      create_subscription(ends_at: ends_at, status: "cancelled")

      expect {
        perform_enqueued_jobs { described_class.perform_now }
      }.to change { ActionMailer::Base.deliveries.count }.by(1)

      mail = ActionMailer::Base.deliveries.last
      expect(mail.subject).to include("grace period")
    end
  end

  describe "expiry" do
    it "marks subscription as expired when past grace period" do
      sub = create_subscription(ends_at: (G2::GRACE_PERIOD + 1.day).ago, status: "active")

      expect {
        perform_enqueued_jobs { described_class.perform_now }
      }.to change { sub.reload.status }.from("active").to("expired")
    end

    it "does not expire subscriptions still within grace period" do
      sub = create_subscription(ends_at: (G2::GRACE_PERIOD - 1.day).ago, status: "cancelled")

      expect {
        perform_enqueued_jobs { described_class.perform_now }
      }.not_to(change { sub.reload.status })
    end
  end

  private

  def create_subscription(ends_at:, status:, auto_renew: false)
    sub = G2::Subscription.subscribe!(
      organization: org,
      module_key: "accounting",
      plan: "level_1",
      billing_period: "monthly"
    )
    sub.update!(status: status, ends_at: ends_at, auto_renew: auto_renew, starts_at: ends_at - 1.month)
    sub
  end
end