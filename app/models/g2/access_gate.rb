class G2::AccessGate
  def initialize(organization)
    @organization = organization
  end

  # Can this org use ANYTHING beyond login/billing? True during the trial,
  # or if at least one module currently grants access. False only once the
  # trial has ended AND every module is either non-existent or past its
  # own grace period - this is what should gate the whole app, not just
  # one feature area.
  def system_locked?
    return false if organization.trial_active?

    G2::Modules::ALL.none? { |module_key| module_accessible?(module_key) }
  end

  # Does THIS SPECIFIC module currently grant access? A lapsed module locks
  # independently - it doesn't affect other modules the org is subscribed to.
  def module_accessible?(module_key)
    return true if organization.trial_active?

    subscription = latest_subscription_for(module_key)
    return false unless subscription
    return false if subscription.pending? # never activated - no access yet

    # Active OR cancelled (cancel! doesn't revoke early) both still count,
    # as long as we're within ends_at + the grace period. This deliberately
    # does NOT check subscription.status == "active" alone - a cancelled
    # subscription keeps access until ends_at, same as everywhere else in
    # this app.
    Time.current <= subscription.ends_at + G2::GRACE_PERIOD
  end

  # Which specific status this module is in, for building a clear message/
  # banner in the frontend - not used for the boolean checks above, just
  # richer reporting.
  def module_status(module_key)
    return :trial if organization.trial_active?

    subscription = latest_subscription_for(module_key)
    return :none unless subscription
    return :none if subscription.pending?

    if Time.current <= subscription.ends_at
      :active
    elsif Time.current <= subscription.ends_at + G2::GRACE_PERIOD
      :grace # lapsed, but still fully usable during the 15-day grace window
    else
      :locked # past grace - pay-only for this module
    end
  end

  private

  attr_reader :organization

  def latest_subscription_for(module_key)
    organization.subscriptions.where(module: module_key).order(created_at: :desc).first
  end
end