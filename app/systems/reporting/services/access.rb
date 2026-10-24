module Reporting
  # What a user may do with the reports of an organization. Report access
  # is per report; there are no row-level restrictions.
  #
  # View (run, drill, print):
  #   - GO3 admins
  #   - members who may read journal entries: they already see every
  #     figure in the explorer
  #   - members with Reports.manage_statements
  #   - members granted the report (directly, or through a role, group or
  #     department)
  # Edit (organization reports only): manage_statements, or an edit grant.
  # An edit grant changes names and lines only: what reveals the whole
  # ledger (the inspection list, mapping rules) also needs
  # manage_statements or the journal entry viewing permissions, and what
  # affects other reports (primary, archive) needs manage_statements.
  # Drill down to journal entry items: journal entry readers only.
  #
  # Permission codes and grants are loaded once per instance.
  class Access
    attr_reader :user, :organization

    def initialize(user, organization)
      @user = user
      @organization = organization
    end

    def member
      return @member if defined?(@member)

      @member = user && organization ? user.member(organization) : nil
    end

    def admin?
      user&.is_go3_admin? || false
    end

    def general_viewer?
      admin? || ReportRegistry::JOURNAL_ENTRY_VIEWERS.any? { |code| codes.include?(code) }
    end

    def manage_statements?
      admin? || codes.include?(Permission::REPORTS_MANAGE_STATEMENTS)
    end

    def manage_access?
      admin? || codes.include?(Permission::REPORTS_MANAGE_ACCESS) || codes.include?(Permission::ORG_ADMIN)
    end

    def drill_to_entries?
      general_viewer?
    end

    def available?(report)
      report.organization_id.nil? || report.organization_id == organization&.id
    end

    def can_view?(report)
      return false unless available?(report)

      general_viewer? || manage_statements? || grants.key?(report.id)
    end

    def can_edit?(report)
      return false unless available?(report) && !report.system?

      manage_statements? || grants[report.id] == "edit"
    end

    # The inspection list shows every balance of the ledger.
    def can_inspect?(report)
      can_view?(report) && (general_viewer? || manage_statements?)
    end

    # Rules may map any account to a line, so they reveal the ledger too.
    def can_edit_mapping?(report)
      can_edit?(report) && (general_viewer? || manage_statements?)
    end

    # Primary reports feed other reports (ratios); archiving drops them.
    def can_manage?(report)
      can_edit?(report) && manage_statements?
    end

    # Reports may be copied by those who can change reports.
    def can_copy?(report)
      can_view?(report) && manage_statements?
    end
    # The visible reports among `reports`.
    def visible(reports)
      reports.select { |report| can_view?(report) }
    end

    def flags(report)
      { can_view: can_view?(report), can_edit: can_edit?(report), can_copy: can_copy?(report),
        can_manage: can_manage?(report), can_manage_access: manage_access? && available?(report),
        can_drill_to_entries: drill_to_entries? }
    end

    private

    def codes
      @codes ||= if member && organization
        member.all_permissions.where(organization_id: organization.id).pluck(:code).to_set
      else
        Set.new
      end
    end

    # report id => strongest access ("edit" beats "view")
    def grants
      @grants ||= begin
        return {} unless member

        grantees = [ member, *member.roles, *member.groups, *member.departments ]
        conditions = grantees.group_by { |g| g.class.polymorphic_name }.transform_values { |list| list.map(&:id) }
        scope = Reporting::ReportGrant.none
        conditions.each do |type, ids|
          scope = scope.or(Reporting::ReportGrant.where(grantee_type: type, grantee_id: ids))
        end
        scope.where(organization_id: organization.id).pluck(:report_id, :access).each_with_object({}) do |(id, access), map|
          map[id] = access == "edit" || map[id] == "edit" ? "edit" : "view"
        end
      end
    end
  end
end
