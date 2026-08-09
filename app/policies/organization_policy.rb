class OrganizationPolicy < ApplicationPolicy
  def index?
    false # only GO3 admins
  end

  def show?
    user.organizations.include?(record)
  end

  def create?
    return true if record.is_trial
    record.parent_id.present? && user.has_permission?(Permission::ORG_ADMIN, record.parent)
  end

  def destroy?
    record.is_trial? && user.has_permission?(Permission::ORG_ADMIN, record)
  end

  def administrate?
    member = user.member(record)
    member&.has_permission?(Permission::ORG_ADMIN) || false
  end

  class Scope < Scope
    def resolve
      if user.is_go3_admin?
        scope.all
      else
        # Return organizations the user is a member of
        scope.joins(:members).where(members: { user_id: user.id })
      end
    end
  end
end
