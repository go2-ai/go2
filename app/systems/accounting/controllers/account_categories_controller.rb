# app/systems/accounting/controllers/account_categories_controller.rb
module Accounting
  class AccountCategoriesController < ApplicationController
    def index
      authorize Accounting::AccountCategory
      account_categories = current_organization.account_categories

      render json: AccountCategoryBlueprint.render(account_categories, view: :index), status: :ok
    end

    def show
      account_category = current_organization.account_categories.find(params[:id])
      authorize account_category

      render json: AccountCategoryBlueprint.render(account_category), status: :ok
    end

    def create
      account_category = current_organization.account_categories.new(permitted_params)
      authorize account_category
      account_category.type = :other

      if account_category.save
        render json: AccountCategoryBlueprint.render(account_category), status: :ok
      else
        render json: { errors: account_category.errors.full_messages }, status: :unprocessable_content
      end
    end

    def update
      account_category = current_organization.account_categories.find(params[:id])
      authorize account_category

      if account_category.update(permitted_params)
        render json: AccountCategoryBlueprint.render(account_category), status: :ok
      else
        render json: { errors: account_category.errors.full_messages }, status: :unprocessable_content
      end
    end

    def destroy
      account_category = current_organization.account_categories.find(params[:id])
      authorize account_category

      if account_category.destroy
        render json: AccountCategoryBlueprint.render(account_category), status: :ok
      else
        render json: { errors: account_category.errors.full_messages }, status: :unprocessable_content
      end
    end

    private

    def permitted_params
      params.permit(:code, *t_params(:name))
    end
  end
end
