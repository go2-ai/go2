class G2::Invoice < ApplicationRecord
  self.table_name = "invoices"

  belongs_to :organization
  has_many :invoice_items, class_name: "G2::InvoiceItem", foreign_key: :invoice_id, dependent: :destroy
  has_many :payments, class_name: "G2::Payment", foreign_key: :invoice_id, dependent: :destroy

  enum :status, { pending: "pending", paid: "paid", cancelled: "cancelled", void: "void" }, default: "pending"

  validates :invoice_number, presence: true, uniqueness: { scope: :organization_id }

  DEFAULT_PAYMENT_TERM_DAYS = 7

  # Bare invoice creation - race-safe numbering, same locking pattern used
  # elsewhere in this app. Doesn't add any line items itself.
  def self.create_for_organization!(organization, attributes = {})
    transaction do
      organization.lock!
      next_number = organization.invoices.count + 1
      due_at = attributes[:due_at] || (Time.current + DEFAULT_PAYMENT_TERM_DAYS.days)

      create!(
        attributes.merge(
          organization: organization,
          invoice_number: "#{organization.id}/#{next_number}",
          due_at: due_at
        )
      )
    end
  end

  # Builds an invoice with a single line item for a freshly-created
  # subscription, prorating the price if the subscription's first period
  # was shortened to sync with the org's billing anchor (Phase 2).
  def self.create_for_subscription!(subscription)
    price = subscription.price

    natural_seconds = subscription.renewal_term == G2::BillingPeriods::ANNUAL ? 1.year.to_i : 1.month.to_i
    actual_seconds = (subscription.ends_at - subscription.starts_at).to_i
    fraction = [actual_seconds.to_f / natural_seconds, 1.0].min
    prorated_amount_cents = (price.amount_cents * fraction).round

    invoice = create_for_organization!(subscription.organization)

    invoice.invoice_items.create!(
      subscription: subscription,
      module: subscription.module,
      plan: subscription.plan,
      quantity: 1,
      unit_price_cents: price.amount_cents,
      amount_cents: prorated_amount_cents,
      period_start: subscription.starts_at,
      period_end: subscription.ends_at
    )

    invoice.recompute_total!
    invoice
  end

  # Builds an invoice charging for a subscription's NEXT period - no
  # proration (renewals are always a full period), and does NOT extend the
  # subscription itself. That only happens once payment confirms - see
  # #mark_paid!'s cascade, which calls subscription.renew! at that point.
  def self.create_for_renewal!(subscription, billing_period: subscription.renewal_term)
    price = G2::Price.current(subscription.module, subscription.plan, billing_period)
    base = [subscription.ends_at, Time.current].max
    new_ends_at = billing_period == G2::BillingPeriods::ANNUAL ? base + 1.year : base + 1.month

    invoice = create_for_organization!(subscription.organization)

    invoice.invoice_items.create!(
      subscription: subscription,
      module: subscription.module,
      plan: subscription.plan,
      quantity: 1,
      unit_price_cents: price.amount_cents,
      amount_cents: price.amount_cents,
      period_start: base,
      period_end: new_ends_at
    )

    # Overage is billed in arrears, for the period that's ENDING now - not
    # the upcoming one (there's no usage to measure for a period that
    # hasn't happened yet).
    add_overage_items!(invoice, subscription)

    invoice.recompute_total!
    invoice
  end

  # One line item per usage-metered key (journal_entries, storage_gb, etc.)
  # that this module+plan has an overage rate for and that was actually
  # exceeded. Usage is measured across the org AND all its descendants.
  def self.add_overage_items!(invoice, subscription)
    G2::PlanLimit.where(module: subscription.module, plan: subscription.plan).find_each do |limit|
      next if limit.unlimited? || limit.overage_price_cents.to_i.zero?

      used = G2::UsageRecord.total_for(
        subscription.organization,
        module_key: subscription.module,
        key: limit.key,
        from: subscription.starts_at,
        to: subscription.ends_at
      )
      overage_units = [used - limit.value, 0].max
      next if overage_units.zero?

      invoice.invoice_items.create!(
        subscription: subscription,
        module: subscription.module,
        plan: subscription.plan,
        quantity: overage_units,
        unit_price_cents: limit.overage_price_cents,
        amount_cents: overage_units * limit.overage_price_cents,
        period_start: subscription.starts_at,
        period_end: subscription.ends_at
      )
    end
  end

  def recompute_total!
    update!(total_cents: invoice_items.sum(:amount_cents))
  end

  def total
    total_cents / 100.0
  end

  # Idempotent - safe to call more than once (IPNs can arrive multiple
  # times). Cascades to activate any subscription this invoice was paying for.
  def mark_paid!
    return if paid?

    transaction do
      update!(status: "paid", paid_at: Time.current)

      invoice_items.includes(:subscription).map(&:subscription).compact.uniq.each do |sub|
        sub.pending? ? sub.activate! : sub.renew!
      end
    end
  end
end