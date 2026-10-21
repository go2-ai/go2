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

    fields :closing_method,
           :retained_earnings_account_id,
           :income_summary_account_id,
           :current_year_profit_account_id,
           :default_fx_gain_account_id,
           :default_fx_loss_account_id,
           :revaluation_line_description_template,
           :revaluation_counter_line_description_template,
           :closing_line_description_templates

    # Revaluation line description templates used where the organization
    # default is blank: { item: { locale => template }, counter: { ... } }.
    field :built_in_revaluation_line_templates do |setting|
      locales = setting.organization&.entry_locales || [ I18n.default_locale.to_s ]
      Accounting::Revaluation::LineDescriptions::KINDS.to_h do |kind|
        [ kind, locales.to_h { |locale| [ locale.to_s, Accounting::Revaluation::LineDescriptions.built_in(kind, locale) ] } ]
      end
    end

    # Closing entry line templates used where the organization default is
    # blank: { kind => { locale => template } }.
    field :built_in_closing_line_templates do |setting|
      locales = setting.organization&.entry_locales || [ I18n.default_locale.to_s ]
      Accounting::Closing::LineDescriptions::KINDS.to_h do |kind|
        [ kind, locales.to_h { |locale| [ locale, Accounting::Closing::LineDescriptions.built_in(kind, locale) ] } ]
      end
    end

    # What is missing to close a fiscal year with these settings.
    field :closing_configuration_errors do |setting|
      setting.closing_configuration_errors
    end
  end
end
