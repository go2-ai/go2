# app/systems/accounting/controllers/balances_controller.rb
module Accounting
  # Read-only balances grouped by account × center1..6 × currency (the
  # same figures the revaluation and closing services work from), for API
  # clients and diagnostics. Amounts are decimal strings to keep precision.
  class BalancesController < ApplicationController
    ID_LIST_PARAMS = %i[
      account_ids ledger_ids account_category_ids currency_ids
      center1_ids center2_ids center3_ids center4_ids center5_ids center6_ids
    ].freeze

    def index
      authorize Accounting::JournalEntry, :index?

      fiscal_year = current_organization.fiscal_years.find_by(id: params[:fiscal_year_id])
      unless fiscal_year
        return render json: { errors: [ controller_t("fiscal_year_required") ] }, status: :unprocessable_content
      end

      rows = Accounting::Balances::Query.new(
        organization: current_organization,
        fiscal_year: fiscal_year,
        as_of: parse_date(:as_of),
        from: parse_date(:from),
        states: boolean_param(:approved_only) ? %w[approved] : Accounting::Balances::Query::DEFAULT_STATES,
        category_types: category_types,
        monetary_only: boolean_param(:monetary_only),
        foreign_only: boolean_param(:foreign_only),
        **id_filters
      ).call

      render json: { rows: Accounting::Balances::RowPresenter.new(rows).as_json }, status: :ok
    rescue Date::Error
      render json: { errors: [ controller_t("invalid_date") ] }, status: :unprocessable_content
    end

    private

    def parse_date(name)
      value = params[name]
      value.present? ? Date.iso8601(value.to_s) : nil
    end

    def boolean_param(name)
      ActiveModel::Type::Boolean.new.cast(params[name]) || false
    end

    def category_types
      types = Array(params[:category_types]).map(&:to_s) & Accounting::AccountCategory.types.keys
      types.presence
    end

    def id_filters
      ID_LIST_PARAMS.each_with_object({}) do |name, filters|
        ids = Array(params[name]).map { |id| Integer(id, exception: false) }.compact
        filters[name] = ids if ids.any?
      end
    end
  end
end
