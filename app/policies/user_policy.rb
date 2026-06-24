class UserPolicy < ApplicationPolicy
  def show?
    record.id == user.id
  end
end
