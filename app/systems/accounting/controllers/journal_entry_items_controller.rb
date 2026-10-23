# app/systems/accounting/controllers/journal_entry_items_controller.rb
module Accounting
  # The explorer: grouped balances (group_by) and the items behind them
  # (index), for a period, entry types and states (see Explorer::EntryScope).
  #
  # Scope params (all optional):
  #   fiscal_year_id     the period when from/to aren't given
  #   from, to           YYYY-MM-DD
  #   entry_types        comma separated or an array; default normal,beginning,revaluation
  #   include_year_end   multi-year ranges: add the year-end and later beginning entries
  #   approved_only      only approved entries (default: booked and approved)
  #
  # ids (comma separated, optional) keeps only these rows: item ids for
  # index, ids of the grouped records for group_by (e.g. the rows selected
  # in the grid, to print only those).
  #
  # view=print (with locale=, the language of the printed template) answers
  # with the data of the explorer and journal entry items prints instead
  # (see Explorer::PrintData).
  class JournalEntryItemsController < ApplicationController
    include PrintLocale

    VIEWS = %w[list print].freeze

    before_action :check_view

    def index
      authorize Accounting::JournalEntry, :index?

      scope = entry_scope
      filters = normalized_filters
      query = Accounting::Explorer::ItemsQuery.new(organization: current_organization, scope: scope, filters: filters)
      items = query.call
      items = items.where(id: ids_param) if ids_param

      if print_view?
        json = with_print_locale do
          Accounting::Explorer::PrintData.new(organization: current_organization, scope: scope, filters: filters)
                                         .items(items)
        end
        return render json: json, status: :ok
      end

      render json: Accounting::JournalEntryItemBlueprint.render(items, view: :with_journal_entry), status: :ok
    rescue Accounting::Explorer::InvalidDimensionError => e
      render json: { errors: [ e.message ] }, status: :unprocessable_content
    rescue Accounting::Explorer::InvalidScopeError => e
      render_scope_error(e)
    rescue Date::Error
      render json: { errors: [ controller_t("invalid_date") ] }, status: :unprocessable_content
    rescue JSON::ParserError
      render json: { errors: [ "Invalid filters" ] }, status: :unprocessable_content
    end

    def group_by
      authorize Accounting::JournalEntry, :index?

      scope = entry_scope
      filters = normalized_filters
      hide_zero_balance = boolean_param(:hide_zero_balance)
      query = Accounting::Explorer::GroupedSummaryQuery.new(
        organization: current_organization,
        scope: scope,
        group_by: permitted_params[:group_by],
        filters: filters,
        hide_zero_balance: hide_zero_balance
      )

      if print_view?
        # Inside the template's locale: the rows carry the records' names.
        json = with_print_locale do
          Accounting::Explorer::PrintData.new(organization: current_organization, scope: scope, filters: filters)
                                         .explorer(group_by: permitted_params[:group_by], rows: grouped_rows(query),
                                                   hide_zero_balance: hide_zero_balance)
        end
        return render json: json, status: :ok
      end

      render json: { group_by: permitted_params[:group_by], rows: grouped_rows(query), meta: scope.meta }, status: :ok
    rescue Accounting::Explorer::InvalidDimensionError => e
      render json: { errors: [ e.message ] }, status: :unprocessable_content
    rescue Accounting::Explorer::InvalidScopeError => e
      render_scope_error(e)
    rescue Date::Error
      render json: { errors: [ controller_t("invalid_date") ] }, status: :unprocessable_content
    rescue JSON::ParserError
      render json: { errors: [ "Invalid filters" ] }, status: :unprocessable_content
    end

    private

    # filters no longer belongs here — it's a JSON string, not a nested param,
    # so `permit` can't validate its shape. It's parsed separately below.
    def permitted_params
      @permitted_params ||= params.permit(:fiscal_year_id, :group_by)
    end

    def entry_scope
      Accounting::Explorer::EntryScope.new(
        organization: current_organization,
        fiscal_year_id: permitted_params[:fiscal_year_id],
        from: parse_date(:from),
        to: parse_date(:to),
        entry_types: entry_types_param,
        include_year_end: boolean_param(:include_year_end),
        approved_only: boolean_param(:approved_only)
      )
    end

    def print_view?
      params[:view] == "print"
    end

    def check_view
      return if params[:view].blank? || VIEWS.include?(params[:view])

      render json: { errors: [ controller_t("invalid_view") ] }, status: :bad_request
    end

    def render_scope_error(error)
      render json: { errors: [ controller_t(error.key, **error.options) ] }, status: :unprocessable_content
    end

    def parse_date(name)
      value = params[name]
      value.present? ? Date.iso8601(value.to_s) : nil
    end

    def boolean_param(name)
      ActiveModel::Type::Boolean.new.cast(params[name]) || false
    end

    # nil when absent (the defaults); an empty value selects no entry types.
    def entry_types_param
      return nil unless params.key?(:entry_types)

      raw = params[:entry_types]
      values = raw.is_a?(String) ? raw.split(",") : Array(raw)
      values.map { |value| value.to_s.strip }.reject(&:empty?)
    end

    # nil when absent: every row.
    def ids_param
      return @ids_param if defined?(@ids_param)

      @ids_param = params[:ids].present? ? params[:ids].to_s.split(",").map(&:to_i) : nil
    end

    def grouped_rows(query)
      rows = query.call
      ids_param ? rows.select { |row| ids_param.include?(row[:id]) } : rows
    end

    def normalized_filters
      raw = params[:filters]
      return [] if raw.blank?

      parsed = raw.is_a?(String) ? JSON.parse(raw) : raw

      Array(parsed).map do |f|
        {
          dimension: f["dimension"] || f[:dimension],
          ids: Array(f["ids"] || f[:ids]).map(&:to_i)
        }
      end
    end
  end
end
