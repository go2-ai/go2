module Accounting
  class SettingBlueprint < Blueprinter::Base
    identifier :id

    fields :use_parent_org_currencies,
           :use_parent_org_accounts,
           :use_parent_org_centers,
           :use_parent_org_fiscal_years,
           :account_category_length,
           :ledger_length,
           :account_length,
           :center_length,
           :center_levels

    field :main_currency_id
  end
end