class HomeController < ApplicationController
  skip_before_action :authenticate_user!

  def index
    render "layouts/react_app"
  end
end
