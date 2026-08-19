class FiscalYearsController < ApplicationController
  before_action :authorize_user!

  def index
    fiscal_years = current_organization.fiscal_years.order(start_date: :asc)
    render json: FiscalYearBlueprint.render(fiscal_years), status: :ok
  end

  def create
    fiscal_year = current_organization.fiscal_years.new(permitted_params)

    if fiscal_year.save
      render json: FiscalYearBlueprint.render(fiscal_year), status: :ok
    else
      render json: { errors: fiscal_year.errors.full_messages }, status: :unprocessable_content
    end
  end

  def update
    fiscal_year = current_organization.fiscal_years.find_by(id: params[:id])
    return render json: { errors: [ controller_t("not_found") ] }, status: :not_found unless fiscal_year

    if fiscal_year.update(permitted_params)
      render json: FiscalYearBlueprint.render(fiscal_year), status: :ok
    else
      render json: { errors: fiscal_year.errors.full_messages }, status: :unprocessable_content
    end
  end

  def destroy
    fiscal_year = current_organization.fiscal_years.find_by(id: params[:id])
    return render json: { errors: [ controller_t("not_found") ] }, status: :not_found unless fiscal_year

    if fiscal_year.destroy
      render json: FiscalYearBlueprint.render(fiscal_year), status: :ok
    else
      render json: { errors: fiscal_year.errors.full_messages }, status: :unprocessable_content
    end
  end

  private

  def authorize_user!
    authorize current_organization, :administrate?
  end

  def permitted_params
    params.permit(:start_date, :finish_date, *t_params(:name))
  end
end
