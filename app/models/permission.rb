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
        tags: []
      },
      {
        code: ACCOUNTING_MANAGE_SETTINGS,
        name: model_t("accounting_manage_settings"),
        abilities: [
          model_t("manage_settings")
        ],
        tags: %w[accounting]
      },
      {
        code: ACCOUNTING_VIEW_SETTINGS,
        name: model_t("accounting_view_settings"),
        abilities: [
          model_t("view_settings")
        ],
        tags: %w[accounting]
      },
      {
        code: ACCOUNTING_MANAGE_CENTERS,
        name: model_t("accounting_manage_centers"),
        abilities: [
          model_t("manage_centers")
        ],
        tags: %w[accounting]
      },
      {
        code: ACCOUNTING_VIEW_CENTERS,
        name: model_t("accounting_view_centers"),
        abilities: [
          model_t("view_centers")
        ],
        tags: %w[accounting]
      },
      {
        code: ACCOUNTING_MANAGE_ACCOUNTS,
        name: model_t("accounting_manage_accounts"),
        abilities: [
          model_t("manage_accounts")
        ],
        tags: %w[accounting]
      },
      {
        code: ACCOUNTING_VIEW_ACCOUNTS,
        name: model_t("accounting_view_accounts"),
        abilities: [
          model_t("view_accounts")
        ],
        tags: %w[accounting]
      },
      {
        code: ACCOUNTING_MANAGE_JOURNAL_ENTRIES,
        name: model_t("accounting_manage_journal_entries"),
        abilities: [
          model_t("manage_journal_entries")
        ],
        tags: %w[accounting]
      },
      {
        code: ACCOUNTING_VIEW_JOURNAL_ENTRIES,
        name: model_t("accounting_view_journal_entries"),
        abilities: [
          model_t("view_journal_entries")
        ],
        tags: %w[accounting]
      },
      {
        code: ACCOUNTING_APPROVE_JOURNAL_ENTRIES,
        name: model_t("accounting_approve_journal_entries"),
        abilities: [
          model_t("approve_journal_entries")
        ],
        tags: %w[accounting]
      }
    ]
  end
end
