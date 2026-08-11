class MeController < ApplicationController
  def show
    render json: current_user, only: %i[id email first_name last_name locale timezone], status: :ok
  end

  def update
    authorize current_user

    if current_user.update(me_params)
      render json: current_user, only: %i[id email first_name last_name locale timezone], status: :ok
    else
      render json: { errors: current_user.errors.full_messages }, status: :unprocessable_entity
    end
  end

  private

  def me_params
    params.require(:me).permit(:first_name, :last_name, :locale, :timezone)
  end
end
