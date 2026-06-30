class RolePolicy < ApplicationPolicy
  def index?
    is_org_admin?
  end

  def create?
    is_org_admin?
  end

  def update?
    is_org_admin?
  end

  def activate?
    is_org_admin?
  end

  def deactivate?
    is_org_admin?
  end

  def assignments?
    is_org_admin?
  end

  def export?
    is_org_admin?
  end

  private

  def is_org_admin?
    record.has_permission?(Permission::ORG_ADMIN)
  end
end
