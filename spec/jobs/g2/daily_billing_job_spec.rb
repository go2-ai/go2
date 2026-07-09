# frozen_string_literal: true

require "rails_helper"

RSpec.describe G2::DailyBillingJob, type: :job do
  describe "#perform" do
    it "calls both child jobs" do
      expect(G2::TrialExpiryJob).to receive(:perform_now)
      expect(G2::SubscriptionExpiryScannerJob).to receive(:perform_now)

      described_class.perform_now
    end
  end
end