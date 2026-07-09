class G2::Price < ApplicationRecord
  self.table_name = "prices" # explicit, so it's obvious rather than relying on demodulization
 
  validates :module, inclusion: { in: G2::Modules::ALL }
  validates :plan, inclusion: { in: G2::Plans::ALL }
  validates :billing_period, inclusion: { in: G2::BillingPeriods::ALL }
  validates :amount_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
 
  scope :active, -> { where(active: true) }
 
  # The price currently in effect for a module+plan+billing_period combo -
  # this is what new subscriptions should reference.
  def self.current(module_key, plan, billing_period)
    active.find_by!(module: module_key, plan: plan, billing_period: billing_period)
  end
 
  # Use this instead of creating a G2::Price row directly when a price
  # changes - it deactivates the old one and inserts the new one atomically,
  # so there's never a moment with zero or two active prices for the same combo.
  def self.replace!(module_key, plan, billing_period, amount_cents)
    transaction do
      active.where(module: module_key, plan: plan, billing_period: billing_period)
            .lock
            .update_all(active: false)
 
      create!(
        module: module_key,
        plan: plan,
        billing_period: billing_period,
        amount_cents: amount_cents,
        active: true
      )
    end
  end
 
  def amount
    amount_cents / 100.0
  end
end
 