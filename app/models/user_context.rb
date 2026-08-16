class UserContext
  attr_reader :user, :organization

  def initialize(user, organization)
    @user = user
    @organization = organization
  end
end