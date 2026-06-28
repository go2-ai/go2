class HomeController < ApplicationController
  def index
    respond_to do |format|
      format.html { render "layouts/react_app" }
      format.json { render json: { status: "ok" } }
    end
  end
end
