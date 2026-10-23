# Report templates are visible to members who may print or manage their report
# (system templates plus the organization's own copies). Members with the
# report's manage permission can create, change and
# delete the organization's own templates; system templates are read-only.
# See ReportRegistry for the permissions of each report.
class ReportTemplatePolicy < ApplicationPolicy
  def index?
    member?
  end

  def show?
    member? && visible? && access.can_view?(record.report_key)
  end

  def create?
    own_template? && access.can_manage?(record.report_key)
  end

  def update?
    own_template? && access.can_manage?(record.report_key)
  end

  def destroy?
    own_template? && access.can_manage?(record.report_key)
  end

  private

  def access
    @access ||= ReportRegistry.access(user, organization)
  end

  def member?
    access.member.present?
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

      scope.for_organization(organization.id).where(report_key: ReportRegistry.access(user, organization).visible_keys)
    end
  end
end
