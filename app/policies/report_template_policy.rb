# Report templates are visible to every member of the organization (system
# templates plus the organization's own copies). Only organization admins can
# create, change or delete templates, and only the organization's own ones:
# system templates are read-only.
class ReportTemplatePolicy < ApplicationPolicy
  def index?
    member?
  end

  def show?
    member? && visible?
  end

  def create?
    manage? && own_template?
  end

  def update?
    manage? && own_template?
  end

  def destroy?
    manage? && own_template?
  end

  private

  def member
    return @member if defined?(@member)

    @member = organization && user.member(organization)
  end

  def member?
    member.present?
  end

  def manage?
    member&.has_permission?(Permission::ORG_ADMIN) || false
  end

  def visible?
    record.system? || record.organization_id == organization&.id
  end

  def own_template?
    record.organization_id.present? && record.organization_id == organization&.id
  end

  class Scope < Scope
    def resolve
      return scope.none unless organization
      return scope.none unless user.is_go3_admin? || user.member(organization)

      scope.for_organization(organization.id)
    end
  end
end
