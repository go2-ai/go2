class G2::Subscription < ApplicationRecord
  self.table_name = "subscriptions"

  belongs_to :organization
  belongs_to :price, class_name: "G2::Price"

  enum :status, { pending: "pending", active: "active", cancelled: "cancelled", expired: "expired" }, default: "pending"

  # "Live" = counts as occupying this module's one-subscription-per-org
  # slot, whether or not it's actually been paid for yet. Matches the
  # partial unique index in the DB - keep these in sync if either changes.
  scope :live, -> { where(status: %w[pending active]) }

  validates :module, inclusion: { in: G2::Modules::ALL }
  validates :plan, inclusion: { in: G2::Plans::ALL }
  validates :renewal_term, inclusion: { in: G2::BillingPeriods::ALL }, allow_nil: true
  validates :starts_at, :ends_at, presence: true

  # NOTE: `module` is a Ruby reserved word. Calling it bare (just `module`)
  # inside a method body is a SYNTAX ERROR, not a runtime one - it must
  # always be called with an explicit receiver: `self.module` or
  # `some_subscription.module`. Same applies to G2::Price/G2::PlanLimit.

  # Creates a new module subscription for an organization, correctly
  # accounting for:
  # - trial: if the org is still in its trial, the subscription doesn't
  #   START until the trial ends - they never lose unused trial days.
  # - billing anchor: if the org already has other active subscriptions,
  #   this one's first period is shortened to end on the same date as
  #   those, so everything renews together going forward. Proration of
  #   the price for that shortened period happens later, when building
  #   the invoice (Phase 3) - this method only gets the dates right.
  def self.subscribe!(organization:, module_key:, plan:, billing_period:)
    transaction do
      organization.lock!

      price = G2::Price.current(module_key, plan, billing_period)
      starts_at = organization.trial_active? ? organization.trial_end_date : Time.current
      natural_ends_at = billing_period == G2::BillingPeriods::ANNUAL ? starts_at + 1.year : starts_at + 1.month

      # The shared renewal date, if the org already has other active
      # subscriptions (to a DIFFERENT module - this is a new subscription,
      # so there won't be an existing row for module_key itself yet).
      anchor = organization.subscriptions.live.where.not(module: module_key).minimum(:ends_at)
      ends_at = (anchor && anchor > starts_at) ? anchor : natural_ends_at

      subscription = create!(
        organization: organization,
        module: module_key,
        plan: plan,
        price: price,
        status: "pending", # only becomes active once the invoice is paid - see #activate!
        starts_at: starts_at,
        ends_at: ends_at,
        renewal_term: billing_period
      )

      # Purchasing ends the trial immediately, even though the subscription
      # itself doesn't START until the trial period's natural end.
      organization.update!(is_trial: false)

      subscription
    end
  end

  # Extends this subscription by one more billing period, always from the
  # LATER of its current end date or today - renewing early never loses
  # already-paid time; renewing after lapsing starts fresh from today
  # rather than compounding missed periods.
  def renew!(billing_period: renewal_term)
    new_price = G2::Price.current(self.module, plan, billing_period)
    base = [ends_at, Time.current].max
    new_ends_at = billing_period == G2::BillingPeriods::ANNUAL ? base + 1.year : base + 1.month

    update!(price: new_price, ends_at: new_ends_at, renewal_term: billing_period, status: "active")
  end

  # Stops auto-renewal but doesn't immediately revoke access - the org
  # keeps this module until ends_at, same as already-paid-for time always works.
  def cancel!
    update!(status: "cancelled", cancelled_at: Time.current, auto_renew: false)
  end

  # Called by G2::Invoice#mark_paid! once payment confirms - this is what
  # actually grants access, per the documented flow (Purchase -> Invoice ->
  # Payment Confirmed -> Subscription Activated).
  def activate!
    update!(status: "active")
  end

  # Cancelled still counts as "currently active" until ends_at - cancel!
  # only stops auto-renewal, it doesn't revoke already-paid-for access.
  def currently_active?
    (active? || cancelled?) && Time.current <= ends_at
  end
end