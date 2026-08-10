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
        render json: { errors: @setting.errors }, status: :unprocessable_entity
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
        :center_levels
      )
    end
  end
end
