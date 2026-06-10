class OrganizationPolicy < ApplicationPolicy
  def index?
    user.is_go3_admin?
  end

  def show?
    user.organizations.include?(record)
  end

  def create?
    # GO3_Admins can always create organizations
    return true if user.is_go3_admin?

    # Normal users can create if they have trial flag
    return true if record.is_trial

    # Users with Organization.admin permission on parent org can create sub-orgs
    record.parent_id.present? && user.has_permission?("Organization.admin", record.parent)
  end

  def update?
    user.is_go3_admin? || user.has_permission?("Organization.admin", record)
  end

  def permitted_attributes
    if user.is_go3_admin?
      [ :name, :description, :parent_id, :is_trial, :settings, :logo ]
    else
      [ :is_trial ]
    end
  end

  def destroy?
    # GO3_Admins can destroy any organization
    return true if user.is_go3_admin?

    # Organization admins can only destroy trial organizations
    record.is_trial? && user.has_permission?("Organization.admin", record)
  end

  def archive?
    user.is_go3_admin?
  end

  def unarchive?
    user.is_go3_admin?
  end

  def administrate?
    user.member(record).has_permission?(Permission::ORG_ADMIN)
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
