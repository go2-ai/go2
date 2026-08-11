class UsersController < ApplicationController
  def show
    authorize current_user
    render json: MemberBlueprint.render(current_user, view: :show), status: :ok
  end
end
