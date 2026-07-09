# frozen_string_literal: true

module G2
  class DailyBillingJob < ApplicationJob
    queue_as :default

    # Single entry point for the daily cron — keeps the schedule simple.
    def perform
      TrialExpiryJob.perform_now
      SubscriptionExpiryScannerJob.perform_now
    end
  end
end