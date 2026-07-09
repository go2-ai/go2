# frozen_string_literal: true

module G2
  class TrialExpiryJob < ApplicationJob
    queue_as :default

    # Runs daily. Finds organizations whose trial ends within the
    # notification window and sends them a heads-up.
    #
    # Two windows:
    #   - 3 days before: "Your trial ends in 3 days"
    #   - 1 day before:  "Your trial ends tomorrow"
    def perform
      notify_orgs_trial_ending_in(3.days)
      notify_orgs_trial_ending_in(1.day)
    end

    private

    def notify_orgs_trial_ending_in(horizon)
      target_date = Date.current + horizon
      orgs = Organization.where(is_trial: true)
                         .where("DATE(created_at) = ?", target_date - G2::TRIAL_PERIOD)

      orgs.find_each do |org|
        org.admins.each do |admin|
          G2::BillingMailer.trial_ending_soon(org, admin, days_left: horizon.to_i / 1.day).deliver_later
        end
      end
    end
  end
end