class Api::MeController < ApplicationController
  before_action :authenticate_user!

  def show
    render json: current_user, only: %i[id email first_name last_name locale], status: :ok
  end
end
