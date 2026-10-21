# app/systems/accounting/policies/currency_revaluation_schedule_policy.rb
module Accounting
  # Same rules as revaluations: viewing with journal entry permissions,
  # changes and runs with the revalue permission.
  class CurrencyRevaluationSchedulePolicy < CurrencyRevaluationPolicy
    def run_now?
      revalue?
    end
  end
end
