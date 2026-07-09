# frozen_string_literal: true

module G2
  class SubscriptionExpiryScannerJob < ApplicationJob
    queue_as :default

    # Runs daily. Handles the full subscription lifecycle:
    #   1. Warns about subscriptions ending soon (3 days / 1 day)
    #   2. Auto-renews subscriptions where auto_renew is true
    #   3. Warns when grace period is about to end
    #   4. Marks subscriptions as expired once past grace period
    def perform
      warn_ending_soon
      process_auto_renewals
      warn_grace_period_ending
      expire_past_grace
    end

    private

    # --- Warning windows ---

    def warn_ending_soon
      [3, 1].each do |days|
        target = Time.current + days.days
        subscriptions_ending_between(target.beginning_of_day, target.end_of_day)
          .find_each { |sub| notify_admins(sub.organization, :subscription_ending_soon, sub, days) }
      end
    end

    def warn_grace_period_ending
      grace_end = Time.current - G2::GRACE_PERIOD + 3.days
      Subscription.where(status: :cancelled)
                  .where(ends_at: grace_end.beginning_of_day..grace_end.end_of_day)
                  .find_each { |sub| notify_admins(sub.organization, :grace_period_ending, sub) }
    end

    # --- Auto-renewal ---

    def process_auto_renewals
      Subscription.live
                  .where(auto_renew: true)
                  .where("ends_at <= ?", Time.current)
                  .find_each { |sub| attempt_auto_renew(sub) }
    end

    def attempt_auto_renew(sub)
      invoice = Invoice.create_for_renewal!(sub)
      sub.organization.admins.each do |admin|
        G2::BillingMailer.renewal_invoice_created(sub.organization, admin, invoice).deliver_later
      end
    rescue StandardError => e
      Rails.logger.error("[G2::SubscriptionExpiryScannerJob] Auto-renewal failed for sub #{sub.id}: #{e.message}")
      notify_admins(sub.organization, :auto_renewal_failed, sub)
    end

    # --- Expiry ---

    def expire_past_grace
      cutoff = Time.current - G2::GRACE_PERIOD
      Subscription.live.where("ends_at <= ?", cutoff).find_each do |sub|
        sub.update!(status: :expired)
        notify_admins(sub.organization, :subscription_expired, sub)
      end
    end

    # --- Helpers ---

    def subscriptions_ending_between(range_start, range_end)
      Subscription.live.where(ends_at: range_start..range_end)
    end

    def notify_admins(org, mailer_action, subscription, days = nil)
      org.admins.each do |admin|
        G2::BillingMailer.public_send(mailer_action, org, admin, subscription, days).deliver_later
      end
    end
  end
end