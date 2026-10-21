# app/systems/accounting/controllers/exchange_rate_sources_controller.rb
module Accounting
  class ExchangeRateSourcesController < ApplicationController
    before_action :set_source, only: %i[update destroy]

    def index
      authorize Accounting::ExchangeRateSource

      sources = current_organization.exchange_rate_sources.order(:currency_id)
      render json: Accounting::ExchangeRateSourceBlueprint.render(sources), status: :ok
    end

    def create
      source = current_organization.exchange_rate_sources.new(permitted_params)
      authorize source

      if source.save
        render json: Accounting::ExchangeRateSourceBlueprint.render(source), status: :ok
      else
        render json: { errors: source.errors.full_messages }, status: :unprocessable_content
      end
    end

    def update
      authorize @source

      if @source.update(permitted_params.except(:currency_id))
        render json: Accounting::ExchangeRateSourceBlueprint.render(@source), status: :ok
      else
        render json: { errors: @source.errors.full_messages }, status: :unprocessable_content
      end
    end

    def destroy
      authorize @source

      if @source.destroy
        render json: Accounting::ExchangeRateSourceBlueprint.render(@source), status: :ok
      else
        render json: { errors: @source.errors.full_messages }, status: :unprocessable_content
      end
    end

    private

    def set_source
      @source = current_organization.exchange_rate_sources.find(params[:id])
    end

    def permitted_params
      params.permit(:currency_id, :provider, :quote_currency_id, :active)
    end
  end
end
