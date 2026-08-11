module Accounting
  class CurrenciesController < ApplicationController
    before_action :authorize_user!, only: %i[create update destroy]

    def index
      render json: CurrencyBlueprint.render(current_organization.currencies), status: :ok
    end

    def create
      currency = current_organization.currencies.new(permitted_params)

      if currency.save
        render json: CurrencyBlueprint.render(currency), status: :ok
      else
        render json: { errors: currency.errors.full_messages }, status: :unprocessable_content
      end
    end

    def update
      currency = current_organization.currencies.find(params[:id])

      if currency.update(permitted_params)
        render json: CurrencyBlueprint.render(currency), status: :ok
      else
        render json: { errors: currency.errors.full_messages }, status: :unprocessable_content
      end
    end

    def destroy
      currency = current_organization.currencies.find(params[:id])

      if currency.destroy
        render json: CurrencyBlueprint.render(currency), status: :ok
      else
        render json: { errors: currency.errors.full_messages }, status: :unprocessable_content
      end
    end

    private

    def authorize_user!
      authorize current_organization.accounting_setting, :update?
    end

    def permitted_params
      params.permit(:abr, :decimal_digits, *t_params(:name))
    end
  end
end
