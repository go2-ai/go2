module Accounting
  class SettingsController < ApplicationController
    before_action :set_setting

    def show
      authorize @setting
      render json: SettingBlueprint.render(@setting)
    end

    def update
      authorize @setting
      if @setting.update(setting_params)
        render json: SettingBlueprint.render(@setting)
      else
        render json: { errors: @setting.errors }, status: :unprocessable_entity
      end
    end

    private

    def set_setting
      @setting = current_organization.accounting_setting ||
                 current_organization.create_accounting_setting!
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
        :center_levels
      )
    end
  end
end
