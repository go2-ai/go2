# app/systems/accounting/controllers/centers_controller.rb
module Accounting
  class CentersController < ApplicationController
    before_action :authorize_user!, only: %i[create update destroy]

    def index
      centers = current_organization.center_types.flat_map(&:centers)

      if params[:center_type_id].present?
        center_type = current_organization.center_types.find(params[:center_type_id])
        centers = center_type.centers.includes(:center_type)
        render json: CenterBlueprint.render(centers, view: :show), status: :ok
      else
        centers = current_organization.centers.includes(:center_type)
        render json: CenterBlueprint.render(centers, view: :index), status: :ok
      end
    end

    def show
      center = find_center
      render json: CenterBlueprint.render(center, view: :show), status: :ok
    end

    def create
      center_type = current_organization.center_types.find(params[:center_type_id])
      center = center_type.centers.new(permitted_params)

      if center_type.auto_increment?
        center.code ||= next_available_code(center_type)
      end

      if center.save
        render json: CenterBlueprint.render(center, view: :show), status: :ok
      else
        render json: { errors: center.errors.full_messages }, status: :unprocessable_content
      end
    end

    def update
      center = find_center

      if center.update(permitted_params)
        render json: CenterBlueprint.render(center, view: :show), status: :ok
      else
        render json: { errors: center.errors.full_messages }, status: :unprocessable_content
      end
    end

    def destroy
      center = find_center

      if center.destroy
        render json: CenterBlueprint.render(center, view: :show), status: :ok
      else
        render json: { errors: center.errors.full_messages }, status: :unprocessable_content
      end
    end

    private

    def find_center
      Accounting::Center
        .where(center_type: current_organization.center_types)
        .includes(:center_type)
        .find(params[:id])
    end

    def authorize_user!
      authorize current_organization.accounting_setting, :update?
    end

    def permitted_params
      permitted = params.permit(:center_type_id, :code, :centerable_type, :centerable_id, *t_params(:name))
      raw_metadata = params.to_unsafe_h[:metadata]
      permitted[:metadata] = raw_metadata if raw_metadata.is_a?(Hash)
      permitted
    end

    def next_available_code(center_type)
      first = center_type.first_code.to_i
      last = center_type.last_code.to_i
      expected_length = center_type.first_code.length

      existing_codes = center_type.centers.pluck(:code).map(&:to_i).to_set

      (first..last).each do |num|
        return num.to_s.rjust(expected_length, "0") unless existing_codes.include?(num)
      end

      nil # No available code in range
    end
  end
end
