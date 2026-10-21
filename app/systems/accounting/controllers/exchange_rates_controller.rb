# app/systems/accounting/controllers/exchange_rates_controller.rb
module Accounting
  class ExchangeRatesController < ApplicationController
    MAX_ROWS = 2000

    before_action :set_exchange_rate, only: %i[update destroy]

    # Rates, newest first. Optional filters: currency_id, from, to.
    def index
      authorize Accounting::ExchangeRate

      rates = current_organization.exchange_rates.order(date: :desc, currency_id: :asc, source: :asc)
      rates = rates.where(currency_id: params[:currency_id]) if params[:currency_id].present?
      rates = rates.where(date: parse_date(:from)..) if params[:from].present?
      rates = rates.where(date: ..parse_date(:to)) if params[:to].present?

      render json: Accounting::ExchangeRateBlueprint.render(rates.limit(MAX_ROWS)), status: :ok
    rescue Date::Error
      render_invalid_date
    end

    def create
      rate = current_organization.exchange_rates.new(permitted_params)
      rate.source = Accounting::ExchangeRate::MANUAL
      rate.created_by = current_member
      authorize rate

      if rate.save
        render json: Accounting::ExchangeRateBlueprint.render(rate), status: :ok
      else
        render json: { errors: rate.errors.full_messages }, status: :unprocessable_content
      end
    end

    # Only manual rates can be edited. Provider rates are overridden by
    # adding a manual rate for the same date, or deleted.
    def update
      authorize @exchange_rate
      unless @exchange_rate.manual?
        return render json: { errors: [ Accounting::ExchangeRate.model_t("errors.provider_rate_read_only") ] },
                      status: :unprocessable_content
      end

      if @exchange_rate.update(permitted_params)
        render json: Accounting::ExchangeRateBlueprint.render(@exchange_rate), status: :ok
      else
        render json: { errors: @exchange_rate.errors.full_messages }, status: :unprocessable_content
      end
    end

    def destroy
      authorize @exchange_rate

      if @exchange_rate.destroy
        render json: Accounting::ExchangeRateBlueprint.render(@exchange_rate), status: :ok
      else
        render json: { errors: @exchange_rate.errors.full_messages }, status: :unprocessable_content
      end
    end

    # Rates in the main currency on a date, as used by revaluation.
    # Params: date (default: today in the organization's time zone),
    # currency_ids[] (default: all non-main currencies).
    def resolve
      authorize Accounting::ExchangeRate

      date = params[:date].present? ? parse_date(:date) : current_organization.today
      resolver = Accounting::ExchangeRates::Resolver.new(organization: current_organization, date: date)
      currency_ids = requested_currency_ids(resolver.main_currency_id)

      rows = currency_ids.map do |currency_id|
        result = resolver.resolve(currency_id)
        {
          currency_id: currency_id,
          rate: result&.rate&.to_s("F"),
          rate_date: result&.rate_date,
          sources: result&.sources || [],
          path: result ? result.path.map { |r| Accounting::ExchangeRateBlueprint.render_as_hash(r) } : [],
          error: resolver.error_for(currency_id)
        }
      end

      render json: { date: date, main_currency_id: resolver.main_currency_id, rates: rows }, status: :ok
    rescue Date::Error
      render_invalid_date
    end

    # Fetches provider rates now for the currencies whose source is a
    # provider. Without from/to the latest published day is fetched;
    # with them the range is backfilled.
    def fetch
      authorize Accounting::ExchangeRate

      from = params[:from].present? ? parse_date(:from) : nil
      to = params[:to].present? ? parse_date(:to) : nil
      result = Accounting::ExchangeRates::Fetcher.new(organization: current_organization).call(from: from, to: to)

      render json: result.as_json, status: :ok
    rescue Date::Error
      render_invalid_date
    rescue Accounting::ExchangeRates::Fetcher::RangeError
      render json: { errors: [ Accounting::ExchangeRate.model_t("errors.invalid_range",
                                                                days: Accounting::ExchangeRates::Fetcher::MAX_RANGE_DAYS) ] },
             status: :unprocessable_content
    rescue Accounting::ExchangeRates::Providers::Ecb::Error => e
      Rails.logger.warn("[ExchangeRatesController#fetch] #{e.message}")
      render json: { errors: [ Accounting::ExchangeRate.model_t("errors.provider_unavailable") ] }, status: :bad_gateway
    end

    private

    def set_exchange_rate
      @exchange_rate = current_organization.exchange_rates.find(params[:id])
    end

    def permitted_params
      params.permit(:currency_id, :quote_currency_id, :date, :rate)
    end

    def parse_date(name)
      Date.iso8601(params[name].to_s)
    end

    def requested_currency_ids(main_currency_id)
      ids = Array(params[:currency_ids]).map { |id| Integer(id, exception: false) }.compact
      scope = current_organization.currencies.where.not(id: main_currency_id)
      scope = scope.where(id: ids) if ids.any?
      scope.order(:abr).pluck(:id)
    end

    def render_invalid_date
      render json: { errors: [ Accounting::ExchangeRate.model_t("errors.invalid_date") ] }, status: :unprocessable_content
    end
  end
end
