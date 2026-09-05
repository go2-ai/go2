# app/systems/accounting/controllers/journal_entries_controller.rb
module Accounting
  class JournalEntriesController < ApplicationController
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

      render json: Accounting::JournalEntryBlueprint.render(@journal_entry, view: params[:view] ? params[:view].to_sym : :show), status: :ok
    end

    def create
      journal_entry = current_organization.journal_entries.new(permitted_params)
      journal_entry.creator = current_member
      authorize journal_entry

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

      ActiveRecord::Base.transaction do
        if @journal_entry.update(permitted_params)
          render json: Accounting::JournalEntryBlueprint.render(@journal_entry, view: :show), status: :ok
        else
          render json: { errors: @journal_entry.errors.full_messages }, status: :unprocessable_content
        end
      end
    end

    def destroy
      authorize @journal_entry

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
      @journal_entry = current_organization.journal_entries.find(params[:id])
    end

    def permitted_params
      params.permit(
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
