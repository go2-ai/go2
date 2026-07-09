# frozen_string_literal: true

module G2
  class BillingMailer < ApplicationMailer
    default from: "billing@example.com" # Replace with your real address

    def trial_ending_soon(organization, admin, days_left:)
      @organization = organization
      @admin = admin
      @days_left = days_left

      mail(
        to: admin.email,
        subject: "Your trial ends in #{days_left} #{'day'.pluralize(days_left)}"
      )
    end

    def subscription_ending_soon(organization, admin, subscription, days_left)
      @organization = organization
      @admin = admin
      @subscription = subscription
      @days_left = days_left

      mail(
        to: admin.email,
        subject: "#{subscription.module.titleize} subscription ends in #{days_left} #{'day'.pluralize(days_left)}"
      )
    end

    def grace_period_ending(organization, admin, subscription, days = nil)
      @organization = organization
      @admin = admin
      @subscription = subscription
      @grace_ends_at = subscription.ends_at + G2::GRACE_PERIOD

      mail(
        to: admin.email,
        subject: "Access to #{subscription.module.titleize} ends soon — grace period closing"
      )
    end

    def renewal_invoice_created(organization, admin, invoice, days = nil)
      @organization = organization
      @admin = admin
      @invoice = invoice

      mail(
        to: admin.email,
        subject: "Your subscription has been renewed — Invoice ##{invoice.invoice_number}"
      )
    end

    def auto_renewal_failed(organization, admin, subscription, days = nil)
      @organization = organization
      @admin = admin
      @subscription = subscription

      mail(
        to: admin.email,
        subject: "Auto-renewal failed for #{subscription.module.titleize}"
      )
    end

    def subscription_expired(organization, admin, subscription, days = nil)
      @organization = organization
      @admin = admin
      @subscription = subscription

      mail(
        to: admin.email,
        subject: "Access to #{subscription.module.titleize} has expired"
      )
    end
  end
end