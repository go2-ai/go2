class Permission < ApplicationRecord
  has_paper_trail

  # Associations
  belongs_to :grantee, polymorphic: true
  belongs_to :organization

  # Validations
  validates :code, presence: true
  validates :grantee, presence: true
  validates :grantee_id, uniqueness: { scope: [ :grantee_type, :code ] }

  ORG_ADMIN = "Organization.admin".freeze
  ACCOUNTING_MANAGE_CENTERS = "Accounting.manage_centers".freeze
  ACCOUNTING_VIEW_CENTERS = "Accounting.view_centers".freeze
  ACCOUNTING_MANAGE_ACCOUNTS = "Accounting.manage_accounts".freeze
  ACCOUNTING_VIEW_ACCOUNTS = "Accounting.view_accounts".freeze

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
      }
    ]
  end
end
