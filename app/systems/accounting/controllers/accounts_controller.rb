# app/systems/accounting/controllers/accounts_controller.rb
module Accounting
  class AccountsController < ApplicationController
    def index
      authorize Accounting::Account
      accounts = current_organization.accounts

      render json: AccountBlueprint.render(accounts), status: :ok
    end

    def show
      account = find_account
      authorize account

      render json: AccountBlueprint.render(account), status: :ok
    end

    def create
      account = Accounting::Account.new(permitted_params)
      authorize account

      if account.save
        render json: AccountBlueprint.render(account), status: :ok
      else
        render json: { errors: account.errors.full_messages }, status: :unprocessable_content
      end
    end

    def update
      account = find_account
      authorize account

      if account.update(permitted_params)
        render json: AccountBlueprint.render(account), status: :ok
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
      Accounting::Account
        .joins(ledger: :account_category)
        .where(account_categories: { organization_id: current_organization.id })
        .find(params[:id])
    end

    def permitted_params
      params.permit(
        :ledger_id,
        :code,
        :contra_for_id,
        :accepts_other_currencies,
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
