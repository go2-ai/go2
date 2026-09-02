# app/systems/accounting/controllers/journal_entry_items_controller.rb
module Accounting
  class JournalEntryItemsController < ApplicationController
    def index
      authorize Accounting::JournalEntry, :index?

      items = Accounting::Explorer::ItemsQuery.new(
        organization: current_organization,
        fiscal_year_id: permitted_params[:fiscal_year_id],
        filters: normalized_filters
      ).call

      render json: Accounting::JournalEntryItemBlueprint.render(items, view: :with_journal_entry), status: :ok
    rescue Accounting::Explorer::InvalidDimensionError => e
      render json: { errors: [ e.message ] }, status: :unprocessable_content
    rescue JSON::ParserError
      render json: { errors: [ "Invalid filters" ] }, status: :unprocessable_content
    end

    def group_by
      authorize Accounting::JournalEntry, :index?

      rows = Accounting::Explorer::GroupedSummaryQuery.new(
        organization: current_organization,
        fiscal_year_id: permitted_params[:fiscal_year_id],
        group_by: permitted_params[:group_by],
        filters: normalized_filters
      ).call

      render json: { group_by: permitted_params[:group_by], rows: rows }, status: :ok
    rescue Accounting::Explorer::InvalidDimensionError => e
      render json: { errors: [ e.message ] }, status: :unprocessable_content
    rescue JSON::ParserError
      render json: { errors: [ "Invalid filters" ] }, status: :unprocessable_content
    end

    private

    # filters no longer belongs here — it's a JSON string, not a nested param,
    # so `permit` can't validate its shape. It's parsed separately below.
    def permitted_params
      @permitted_params ||= params.permit(:fiscal_year_id, :group_by)
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
