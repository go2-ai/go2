# app/systems/accounting/controllers/accounts_controller.rb
module Accounting
  class AccountsController < ApplicationController
    def index
      authorize Accounting::Account
      # full_code reads the ledger and its account category
      accounts = current_organization.accounts.includes(ledger: :account_category)

      render json: AccountBlueprint.render(accounts), status: :ok
    end

    def show
      account = find_account
      authorize account

      render json: AccountBlueprint.render(account, view: :show), status: :ok
    end

    def create
      account = Accounting::Account.new(permitted_params)
      authorize account
      return if render_foreign_references(account)

      if account.save
        render json: AccountBlueprint.render(account), status: :ok
      else
        render json: { errors: account.errors.full_messages }, status: :unprocessable_content
      end
    end

    def update
      account = find_account
      authorize account
      account.assign_attributes(permitted_params)
      return if render_foreign_references(account)

      if account.save
        render json: AccountBlueprint.render(account, view: :show), status: :ok
      else
        render json: { errors: account.errors.full_messages }, status: :unprocessable_content
      end
    end

    def destroy
      account = find_account
      authorize account

      if account.destroy
        render json: AccountBlueprint.render(account), status: :ok
      else
        render json: { errors: account.errors.full_messages }, status: :unprocessable_content
      end
    end

    private

    def find_account
      current_organization.accounts.find(params[:id])
    end

    # The ledger, contra account and FX accounts must be the organization's
    # own (ids come from the request).
    def render_foreign_references(account)
      errors = []
      errors << :ledger if account.ledger_id && !current_organization.ledgers.exists?(account.ledger_id)
      %i[contra_for fx_gain_account fx_loss_account].each do |name|
        id = account.public_send(name == :contra_for ? :contra_for_id : "#{name}_id")
        errors << name if id && !current_organization.accounts.exists?(id)
      end
      return false if errors.empty?

      messages = errors.map { |name| account.errors.full_message(name, Accounting::Account.model_t("errors.not_in_organization")) }
      render json: { errors: messages }, status: :unprocessable_content
      true
    end

    def permitted_params
      params.permit(
        :ledger_id,
        :code,
        :contra_for_id,
        :accepts_other_currencies,
        :fx_gain_account_id,
        :fx_loss_account_id,
        *t_params(:name),
        allowed_center_types_1: [],
        allowed_center_types_2: [],
        allowed_center_types_3: [],
        allowed_center_types_4: [],
        allowed_center_types_5: [],
        allowed_center_types_6: []
      )
    end
  end
end
