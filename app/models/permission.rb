class Permission < ApplicationRecord
  has_paper_trail meta: {
    metadata: ->(permission) {
      {
        organization_id: permission.organization_id,
        permission_code: permission.code,
        grantee_type: permission.grantee_type,
        grantee_id: permission.grantee_id
      }
    }
  }

  # Associations
  belongs_to :grantee, polymorphic: true
  belongs_to :organization

  # Validations
  validates :code, presence: true
  validates :grantee, presence: true
  validates :grantee_id, uniqueness: { scope: [ :grantee_type, :code ] }

  ORG_ADMIN = "Organization.admin".freeze
  ACCOUNTING_MANAGE_SETTINGS = "Accounting.manage_settings".freeze
  ACCOUNTING_VIEW_SETTINGS = "Accounting.view_settings".freeze
  ACCOUNTING_MANAGE_CENTERS = "Accounting.manage_centers".freeze
  ACCOUNTING_VIEW_CENTERS = "Accounting.view_centers".freeze
  ACCOUNTING_MANAGE_ACCOUNTS = "Accounting.manage_accounts".freeze
  ACCOUNTING_VIEW_ACCOUNTS = "Accounting.view_accounts".freeze
  ACCOUNTING_MANAGE_JOURNAL_ENTRIES = "Accounting.manage_journal_entries".freeze
  ACCOUNTING_VIEW_JOURNAL_ENTRIES = "Accounting.view_journal_entries".freeze
  ACCOUNTING_APPROVE_JOURNAL_ENTRIES = "Accounting.approve_journal_entries".freeze
  ACCOUNTING_VIEW_EXCHANGE_RATES = "Accounting.view_exchange_rates".freeze
  ACCOUNTING_MANAGE_EXCHANGE_RATES = "Accounting.manage_exchange_rates".freeze
  ACCOUNTING_REVALUE_CURRENCIES = "Accounting.revalue_currencies".freeze
  ACCOUNTING_CLOSE_FISCAL_YEARS = "Accounting.close_fiscal_years".freeze
  REPORTS_MANAGE_JOURNAL_ENTRY = "Reports.manage_journal_entry".freeze
  REPORTS_MANAGE_CURRENCY_REVALUATION = "Reports.manage_currency_revaluation".freeze
  REPORTS_MANAGE_EXPLORER = "Reports.manage_explorer".freeze
  REPORTS_MANAGE_JOURNAL_ENTRY_ITEMS = "Reports.manage_journal_entry_items".freeze

  def self.grantable_permissions
    [
      {
        code: ORG_ADMIN,
        name: model_t("organization_admin"),
        abilities: [
          model_t("manage_members"),
          model_t("manage_departments"),
          model_t("manage_roles"),
          model_t("manage_groups"),
          model_t("manage_permissions")
        ],
        tags: [],
        perquisites: []
      },
      {
        code: ACCOUNTING_MANAGE_SETTINGS,
        name: model_t("accounting_manage_settings"),
        abilities: [
          model_t("manage_settings")
        ],
        tags: %w[accounting],
        perquisites: [ ACCOUNTING_VIEW_SETTINGS ]
      },
      {
        code: ACCOUNTING_VIEW_SETTINGS,
        name: model_t("accounting_view_settings"),
        abilities: [
          model_t("view_settings")
        ],
        tags: %w[accounting],
        perquisites: []
      },
      {
        code: ACCOUNTING_MANAGE_CENTERS,
        name: model_t("accounting_manage_centers"),
        abilities: [
          model_t("manage_centers")
        ],
        tags: %w[accounting],
        perquisites: [ ACCOUNTING_VIEW_CENTERS ]
      },
      {
        code: ACCOUNTING_VIEW_CENTERS,
        name: model_t("accounting_view_centers"),
        abilities: [
          model_t("view_centers")
        ],
        tags: %w[accounting],
        perquisites: []
      },
      {
        code: ACCOUNTING_MANAGE_ACCOUNTS,
        name: model_t("accounting_manage_accounts"),
        abilities: [
          model_t("manage_accounts")
        ],
        tags: %w[accounting],
        perquisites: [ ACCOUNTING_VIEW_ACCOUNTS ]
      },
      {
        code: ACCOUNTING_VIEW_ACCOUNTS,
        name: model_t("accounting_view_accounts"),
        abilities: [
          model_t("view_accounts")
        ],
        tags: %w[accounting],
        perquisites: []
      },
      {
        code: ACCOUNTING_MANAGE_JOURNAL_ENTRIES,
        name: model_t("accounting_manage_journal_entries"),
        abilities: [
          model_t("manage_journal_entries")
        ],
        tags: %w[accounting],
        perquisites: [ ACCOUNTING_VIEW_JOURNAL_ENTRIES ]
      },
      {
        code: ACCOUNTING_VIEW_JOURNAL_ENTRIES,
        name: model_t("accounting_view_journal_entries"),
        abilities: [
          model_t("view_journal_entries")
        ],
        tags: %w[accounting],
        perquisites: []
      },
      {
        code: ACCOUNTING_APPROVE_JOURNAL_ENTRIES,
        name: model_t("accounting_approve_journal_entries"),
        abilities: [
          model_t("approve_journal_entries")
        ],
        tags: %w[accounting],
        perquisites: [ ACCOUNTING_VIEW_JOURNAL_ENTRIES ]
      },
      {
        code: ACCOUNTING_VIEW_EXCHANGE_RATES,
        name: model_t("accounting_view_exchange_rates"),
        abilities: [
          model_t("view_exchange_rates")
        ],
        tags: %w[accounting],
        perquisites: []
      },
      {
        code: ACCOUNTING_MANAGE_EXCHANGE_RATES,
        name: model_t("accounting_manage_exchange_rates"),
        abilities: [
          model_t("manage_exchange_rates")
        ],
        tags: %w[accounting],
        perquisites: [ ACCOUNTING_VIEW_EXCHANGE_RATES ]
      },
      {
        code: ACCOUNTING_REVALUE_CURRENCIES,
        name: model_t("accounting_revalue_currencies"),
        abilities: [
          model_t("revalue_currencies")
        ],
        tags: %w[accounting],
        perquisites: [ ACCOUNTING_VIEW_JOURNAL_ENTRIES, ACCOUNTING_VIEW_EXCHANGE_RATES ]
      },
      {
        code: ACCOUNTING_CLOSE_FISCAL_YEARS,
        name: model_t("accounting_close_fiscal_years"),
        abilities: [
          model_t("close_fiscal_years")
        ],
        tags: %w[accounting],
        perquisites: [ ACCOUNTING_APPROVE_JOURNAL_ENTRIES ]
      },
      {
        code: REPORTS_MANAGE_JOURNAL_ENTRY,
        name: model_t("reports_manage_journal_entry"),
        abilities: [
          model_t("manage_journal_entry_reports")
        ],
        tags: %w[accounting reports],
        perquisites: [ ACCOUNTING_VIEW_JOURNAL_ENTRIES ]
      },
      {
        code: REPORTS_MANAGE_CURRENCY_REVALUATION,
        name: model_t("reports_manage_currency_revaluation"),
        abilities: [
          model_t("manage_currency_revaluation_reports")
        ],
        tags: %w[accounting reports],
        perquisites: [ ACCOUNTING_REVALUE_CURRENCIES ]
      },
      {
        code: REPORTS_MANAGE_EXPLORER,
        name: model_t("reports_manage_explorer"),
        abilities: [
          model_t("manage_explorer_reports")
        ],
        tags: %w[accounting reports],
        perquisites: [ ACCOUNTING_VIEW_JOURNAL_ENTRIES ]
      },
      {
        code: REPORTS_MANAGE_JOURNAL_ENTRY_ITEMS,
        name: model_t("reports_manage_journal_entry_items"),
        abilities: [
          model_t("manage_journal_entry_items_reports")
        ],
        tags: %w[accounting reports],
        perquisites: [ ACCOUNTING_VIEW_JOURNAL_ENTRIES ]
      }
    ]
  end

  # Returns the full (recursively-resolved) list of prerequisite codes for
  # a given permission code, e.g. prerequisites_for(ACCOUNTING_MANAGE_ACCOUNTS)
  # => [ACCOUNTING_VIEW_ACCOUNTS]
  def self.prerequisites_for(code, seen = Set.new)
    return [] if code.blank? || seen.include?(code)

    seen << code
    definition = grantable_permissions.find { |p| p[:code] == code }
    return [] unless definition

    direct = definition[:perquisites] || []
    direct + direct.flat_map { |prereq_code| prerequisites_for(prereq_code, seen) }
  end

  # Reverse of prerequisites_for: returns the codes of permissions that
  # list `code` as a direct or transitive prerequisite -- i.e. permissions
  # that would be left "dangling" if `code` were revoked while they're
  # still granted to the same grantee.
  def self.dependents_for(code)
    grantable_permissions
      .select { |p| prerequisites_for(p[:code]).include?(code) }
      .map { |p| p[:code] }
  end
end
