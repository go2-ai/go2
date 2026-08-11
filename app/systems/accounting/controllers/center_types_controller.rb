# app/systems/accounting/controllers/center_types_controller.rb
module Accounting
  class CenterTypesController < ApplicationController
    before_action :authorize_user!, only: %i[create update destroy]

    def index
      render json: CenterTypeBlueprint.render(current_organization.center_types), status: :ok
    end

    def create
      center_type = current_organization.center_types.new(permitted_params)

      if center_type.save
        render json: CenterTypeBlueprint.render(center_type), status: :ok
      else
        render json: { errors: center_type.errors.full_messages }, status: :unprocessable_content
      end
    end

    def update
      center_type = current_organization.center_types.find(params[:id])

      if center_type.update(permitted_params)
        render json: CenterTypeBlueprint.render(center_type), status: :ok
      else
        render json: { errors: center_type.errors.full_messages }, status: :unprocessable_content
      end
    end

    def destroy
      center_type = current_organization.center_types.find(params[:id])

      if center_type.destroy
        render json: CenterTypeBlueprint.render(center_type), status: :ok
      else
        render json: { errors: center_type.errors.full_messages }, status: :unprocessable_content
      end
    end

    private

    def authorize_user!
      authorize current_organization.accounting_setting, :update?
    end

    def permitted_params
      permitted = params.permit(:first_code, :last_code, :auto_increment, *t_params(:name))
      if params[:metadata].present?
        permitted[:metadata] = JSON.parse(params[:metadata].to_json)
      end
      permitted
    end
  end
end
