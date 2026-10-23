# The printable reports of the app and who may use them.
#
# Every report key has:
# - manage: the permission to copy, design, rename and delete its templates
#   and to set the default template for the whole organization (nobody
#   manages without it, organization admins included);
# - print: the permissions that allow printing it (any of them), which also
#   allow seeing its templates and picking a personal default. They match
#   the "view" rule of the printed record.
module ReportRegistry
  # Whoever may read journal entries (JournalEntryPolicy#index? and #show?).
  JOURNAL_ENTRY_VIEWERS = [
    Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES,
    Permission::ACCOUNTING_MANAGE_JOURNAL_ENTRIES,
    Permission::ACCOUNTING_APPROVE_JOURNAL_ENTRIES
  ].freeze

  REPORTS = {
    "journal_entry" => {
      manage: Permission::REPORTS_MANAGE_JOURNAL_ENTRY,
      print: JOURNAL_ENTRY_VIEWERS
    },
    "currency_revaluation" => {
      manage: Permission::REPORTS_MANAGE_CURRENCY_REVALUATION,
      print: [ Permission::ACCOUNTING_REVALUE_CURRENCIES, *JOURNAL_ENTRY_VIEWERS ]
    },
    # The explorer pages (group_by and the items behind it).
    "explorer" => {
      manage: Permission::REPORTS_MANAGE_EXPLORER,
      print: JOURNAL_ENTRY_VIEWERS
    },
    "journal_entry_items" => {
      manage: Permission::REPORTS_MANAGE_JOURNAL_ENTRY_ITEMS,
      print: JOURNAL_ENTRY_VIEWERS
    }
  }.freeze

  def self.keys
    REPORTS.keys
  end

  def self.known?(report_key)
    REPORTS.key?(report_key.to_s)
  end

  def self.manage_permission(report_key)
    REPORTS.dig(report_key.to_s, :manage)
  end

  def self.print_permissions(report_key)
    REPORTS.dig(report_key.to_s, :print) || []
  end

  def self.access(user, organization)
    Access.new(user, organization)
  end

  # What a user may do with the reports of an organization. Permission codes
  # are loaded once, so checking several report keys costs one query.
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

    def can_print?(report_key)
      return false unless ReportRegistry.known?(report_key)
      return true if all?

      ReportRegistry.print_permissions(report_key).any? { |code| codes.include?(code) }
    end

    def can_manage?(report_key)
      return false unless ReportRegistry.known?(report_key)
      return true if all?

      codes.include?(ReportRegistry.manage_permission(report_key))
    end

    # Whether the report's templates are listed: to those who print them or
    # manage them.
    def can_view?(report_key)
      can_print?(report_key) || can_manage?(report_key)
    end

    def visible_keys
      ReportRegistry.keys.select { |key| can_view?(key) }
    end

    private

    # GO3 admins may do everything (they also bypass authorize).
    def all?
      user&.is_go3_admin? || false
    end

    def codes
      @codes ||= if member && organization
        member.all_permissions.where(organization_id: organization.id).pluck(:code).to_set
      else
        Set.new
      end
    end
  end
end
