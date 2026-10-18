# app/systems/accounting/controllers/journal_entries_controller.rb
module Accounting
  class JournalEntriesController < ApplicationController
    # Blueprint views that clients may request with ?view=
    SHOW_VIEWS = %w[show print].freeze

    # Associations the item serializers read (account code/name, currency abr,
    # center codes for print), loaded up front instead of one query per item.
    ITEM_INCLUDES = [
      :currency, :center1, :center2, :center3, :center4, :center5, :center6,
      { account: { ledger: :account_category } }
    ].freeze

    before_action :set_journal_entry, only: [ :show, :update, :destroy, :approve, :unapprove ]

    def index
      authorize Accounting::JournalEntry

      journal_entries = current_organization.journal_entries
                           .includes(:fiscal_year, :creator, items: [ :account, :currency ])
                           .order(date: :desc, no: :desc)

      journal_entries = journal_entries.where(fiscal_year_id: params[:fiscal_year_id]) if params[:fiscal_year_id].present?

      render json: Accounting::JournalEntryBlueprint.render(journal_entries, view: :show), status: :ok
    end

    def show
      authorize @journal_entry

      view = params[:view].presence || "show"
      unless SHOW_VIEWS.include?(view)
        return render json: { errors: [ "Unknown view: #{view}" ] }, status: :bad_request
      end

      render json: Accounting::JournalEntryBlueprint.render(@journal_entry, view: view.to_sym), status: :ok
    end

    def create
      journal_entry = current_organization.journal_entries.new(permitted_params)
      journal_entry.creator = current_member
      authorize journal_entry
      return unless load_active_fiscal_year

      journal_entry.fiscal_year ||= @active_fiscal_year
      journal_entry.active_fiscal_year = @active_fiscal_year

      ActiveRecord::Base.transaction do
        if journal_entry.save
          render json: Accounting::JournalEntryBlueprint.render(journal_entry, view: :show), status: :ok
        else
          render json: { errors: journal_entry.errors.full_messages }, status: :unprocessable_content
        end
      end
    end

    def update
      authorize @journal_entry
      return unless load_active_fiscal_year

      @journal_entry.active_fiscal_year = @active_fiscal_year

      ActiveRecord::Base.transaction do
        if @journal_entry.update(permitted_params)
          render json: Accounting::JournalEntryBlueprint.render(@journal_entry, view: :show), status: :ok
        else
          render json: { errors: @journal_entry.errors.full_messages }, status: :unprocessable_content
        end
      end
    end

    def destroy
      # Approved entries must be unapproved first. Checked before the destroy
      # policy (which also rejects them) so the user gets a clear message
      # instead of a generic "not authorized".
      if @journal_entry.approved?
        authorize @journal_entry, :show?
        return render json: { errors: [ Accounting::JournalEntry.model_t("errors.unapprove_before_delete") ] },
                      status: :unprocessable_content
      end

      authorize @journal_entry
      return unless load_active_fiscal_year

      @journal_entry.active_fiscal_year = @active_fiscal_year

      if @journal_entry.destroy
        render json: Accounting::JournalEntryBlueprint.render(@journal_entry, view: :show), status: :ok
      else
        render json: { errors: @journal_entry.errors.full_messages }, status: :unprocessable_content
      end
    end

    def approve
      authorize @journal_entry

      if @journal_entry.update(state: :approved)
        render json: Accounting::JournalEntryBlueprint.render(@journal_entry, view: :show), status: :ok
      else
        render json: { errors: @journal_entry.errors.full_messages }, status: :unprocessable_content
      end
    end

    def unapprove
      authorize @journal_entry

      if @journal_entry.update(state: :booked)
        render json: Accounting::JournalEntryBlueprint.render(@journal_entry, view: :show), status: :ok
      else
        render json: { errors: @journal_entry.errors.full_messages }, status: :unprocessable_content
      end
    end

    private

    def set_journal_entry
      @journal_entry = current_organization.journal_entries
                                            .includes(:creator, items: ITEM_INCLUDES)
                                            .find(params[:id])
    end

    # Writes are scoped to the fiscal year the user has selected in the UI,
    # sent as `active_fiscal_year_id` (body or query string). Renders a 422 and
    # returns false when it is missing or does not belong to the organization.
    def load_active_fiscal_year
      @active_fiscal_year = current_organization.fiscal_years.find_by(id: params[:active_fiscal_year_id])
      return true if @active_fiscal_year

      render json: { errors: [ Accounting::JournalEntry.model_t("errors.active_fiscal_year_required") ] },
             status: :unprocessable_content
      false
    end

    def permitted_params
      params.permit(
        :no,
        :date,
        :effective_date,
        :fiscal_year_id,
        :state,
        :entry_type,
        *t_params(:description),
        items_attributes: [
          :id,
          :row,
          :account_id,
          :center1_id,
          :center2_id,
          :center3_id,
          :center4_id,
          :center5_id,
          :center6_id,
          :debit,
          :credit,
          :currency_id,
          :rate,
          :currency_amount,
          :_destroy,
          *t_params(:description)
        ]
      )
    end
  end
end
