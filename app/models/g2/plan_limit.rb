class G2::PlanLimit < ApplicationRecord
  self.table_name = "plan_limits" # explicit, so it's obvious rather than relying on demodulization
 
  validates :module, inclusion: { in: G2::Modules::ALL }
  validates :plan, inclusion: { in: G2::Plans::ALL }
  validates :key, presence: true
  validates :value, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
  validates :overage_price_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }, allow_nil: true
 
  # The allowance/overage rule for a module+plan+usage key, e.g.
  # G2::PlanLimit.for("accounting", "level_2", "journal_entries")
  def self.for(module_key, plan, key)
    find_by!(module: module_key, plan: plan, key: key)
  end
 
  def unlimited?
    value.nil?
  end
end
 