class OnboardingController < ApplicationController
  
  before_action :check_organization_exists, only: [ :new ]

  def new
    @organization = Organization.new
  end

  private

  def check_organization_exists
    if current_user.organizations.exists?
      redirect_to root_path
    end
  end
end
