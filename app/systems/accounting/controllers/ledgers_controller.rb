# app/systems/accounting/controllers/ledgers_controller.rb
module Accounting
  class LedgersController < ApplicationController
    def index
      authorize Accounting::Ledger
      ledgers = current_organization.account_categories
        .flat_map(&:ledgers)

      render json: LedgerBlueprint.render(ledgers, view: :index), status: :ok
    end

    def show
      ledger = find_ledger
      authorize ledger

      render json: LedgerBlueprint.render(ledger, view: :show), status: :ok
    end

    def create
      ledger = Accounting::Ledger.new(permitted_params)
      authorize ledger

      if ledger.save
        render json: LedgerBlueprint.render(ledger, view: :show), status: :ok
      else
        render json: { errors: ledger.errors.full_messages }, status: :unprocessable_content
      end
    end

    def update
      ledger = find_ledger
      authorize ledger

      if ledger.update(permitted_params)
        render json: LedgerBlueprint.render(ledger, view: :show), status: :ok
      else
        render json: { errors: ledger.errors.full_messages }, status: :unprocessable_content
      end
    end

    def destroy
      ledger = find_ledger
      authorize ledger

      if ledger.destroy
        render json: LedgerBlueprint.render(ledger, view: :show), status: :ok
      else
        render json: { errors: ledger.errors.full_messages }, status: :unprocessable_content
      end
    end

    private

    def find_ledger
      Accounting::Ledger.find(params[:id])
    end

    def permitted_params
      params.permit(
        :account_category_id,
        :code,
        :contra_for_id,
        :unexpected_balance,
        :is_monetary,
        *t_params(:name)
      )
    end
  end
end
