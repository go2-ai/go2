module Accounting
  class SettingsController < ApplicationController
    before_action :authorize_user!

    def show
      render json: SettingBlueprint.render(@setting)
    end

    def update
      if @setting.update(setting_params)
        render json: SettingBlueprint.render(@setting)
      else
        render json: { errors: @setting.errors.full_messages }, status: :unprocessable_content
      end
    end

    private

    def authorize_user!
      @setting = current_organization.accounting_setting
      authorize @setting
    end

    def setting_params
      params.require(:accounting_setting).permit(
        :main_currency_id,
        :use_parent_org_currencies,
        :use_parent_org_accounts,
        :use_parent_org_centers,
        :use_parent_org_fiscal_years,
        :account_category_length,
        :ledger_length,
        :account_length,
        :center_length,
        :center_levels,
        :closing_method,
        :retained_earnings_account_id,
        :income_summary_account_id,
        :current_year_profit_account_id,
        :default_fx_gain_account_id,
        :default_fx_loss_account_id
      ).to_h.merge(line_template_params)
    end

    # { locale => template } (closing: { kind => { locale => template } })
    # limited to the organization's languages and the known kinds.
    def line_template_params
      raw = params.require(:accounting_setting)
      templates = {}
      %i[revaluation_line_description_template revaluation_counter_line_description_template].each do |attribute|
        templates[attribute] = locale_texts_param(raw[attribute]) || {} if raw.key?(attribute)
      end
      if raw.key?(:closing_line_description_templates)
        closing = raw[:closing_line_description_templates]
        templates[:closing_line_description_templates] = Accounting::Closing::LineDescriptions::KINDS.each_with_object({}) do |kind, by_kind|
          texts = closing.respond_to?(:permit) ? locale_texts_param(closing[kind]) : nil
          by_kind[kind] = texts if texts
        end
      end
      templates
    end
  end
end
