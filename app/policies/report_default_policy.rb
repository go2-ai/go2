# Organization defaults are set by members with the report's manage
# permission. Personal defaults are set by members for themselves,
# if they may print the report. See ReportRegistry.
class ReportDefaultPolicy < ApplicationPolicy
  def show?
    access.member.present? && access.can_view?(record.report_key)
  end

  def update?
    if record.personal?
      access.member.present? && record.member_id == access.member.id && access.can_print?(record.report_key)
    else
      access.can_manage?(record.report_key)
    end
  end

  def destroy?
    update?
  end

  private

  def access
    @access ||= ReportRegistry.access(user, organization)
  end
end
