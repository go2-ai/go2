# app/systems/accounting/controllers/ledgers_controller.rb
module Accounting
  class LedgersController < ApplicationController
    def index
      authorize Accounting::Ledger
      ledgers = current_organization.ledgers

      render json: LedgerBlueprint.render(ledgers), status: :ok
    end

    def show
      ledger = find_ledger
      authorize ledger

      render json: LedgerBlueprint.render(ledger, view: :show), status: :ok
    end

    def create
      ledger = Accounting::Ledger.new(permitted_params)
      authorize ledger
      return if render_foreign_references(ledger)

      if ledger.save
        render json: LedgerBlueprint.render(ledger, view: :show), status: :ok
      else
        render json: { errors: ledger.errors.full_messages }, status: :unprocessable_content
      end
    end

    def update
      ledger = find_ledger
      authorize ledger
      ledger.assign_attributes(permitted_params)
      return if render_foreign_references(ledger)

      if ledger.save
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
      current_organization.ledgers.find(params[:id])
    end

    # The category, contra ledger and FX accounts must be the organization's
    # own (ids come from the request).
    def render_foreign_references(ledger)
      errors = []
      errors << :account_category if ledger.account_category_id && !current_organization.account_categories.exists?(ledger.account_category_id)
      errors << :contra_for if ledger.contra_for_id && !current_organization.ledgers.exists?(ledger.contra_for_id)
      %i[fx_gain_account fx_loss_account].each do |name|
        id = ledger.public_send("#{name}_id")
        errors << name if id && !current_organization.accounts.exists?(id)
      end
      return false if errors.empty?

      messages = errors.map { |name| ledger.errors.full_message(name, Accounting::Ledger.model_t("errors.not_in_organization")) }
      render json: { errors: messages }, status: :unprocessable_content
      true
    end

    def permitted_params
      params.permit(
        :account_category_id,
        :code,
        :contra_for_id,
        :unexpected_balance,
        :is_monetary,
        :fx_gain_account_id,
        :fx_loss_account_id,
        *t_params(:name)
      )
    end
  end
end
