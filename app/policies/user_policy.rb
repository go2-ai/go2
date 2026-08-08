class UserPolicy < ApplicationPolicy
  def show?
    record.id == user.id
  end

  def update?
    record.id == user.id
  end
end
