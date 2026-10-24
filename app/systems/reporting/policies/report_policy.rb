module Reporting
  # Per-report access; see Reporting::Access for the rules.
  class ReportPolicy < ApplicationPolicy
    def index?
      access.member.present?
    end

    def show?
      access.can_view?(record)
    end

    alias run? show?
    alias drill? show?

    def copy?
      access.can_copy?(record)
    end

    def update?
      access.can_edit?(record)
    end

    # Make primary, archive, unarchive.
    def manage?
      access.can_manage?(record)
    end

    def inspect?
      access.can_inspect?(record)
    end

    def edit_mapping?
      access.can_edit_mapping?(record)
    end
    def destroy?
      manage?
    end

    def manage_access?
      access.manage_access? && access.available?(record)
    end

    private

    def access
      @access ||= Reporting::Access.new(user, organization)
    end
  end
end
