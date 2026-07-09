module G2
  module Modules
    GENERAL      = "general"
    ACCOUNTING   = "accounting"
    PAYROLL      = "payroll"
    INVENTORY    = "inventory"
    FIXED_ASSETS = "fixed_assets"

    ALL = [ GENERAL, ACCOUNTING, PAYROLL, INVENTORY, FIXED_ASSETS ].freeze
  end

  module Plans
    LEVEL_1 = "level_1"
    LEVEL_2 = "level_2"
    LEVEL_3 = "level_3"

    ALL = [ LEVEL_1, LEVEL_2, LEVEL_3 ].freeze
  end

  module BillingPeriods
    MONTHLY = "monthly"
    ANNUAL  = "annual"

    ALL = [ MONTHLY, ANNUAL ].freeze
  end

  TRIAL_PERIOD = 15.days
  GRACE_PERIOD = 15.days
  DESTROY_GRACE_PERIOD = 15.days
end
