class Member < ApplicationRecord
  include TranslationHelper

  has_paper_trail
  acts_as_archival

  extend Mobility
  translates :name

  # Associations
  belongs_to :organization
  belongs_to :user, optional: true
  has_many :role_assignments, -> { active }
  has_many :roles, through: :role_assignments, source: :role
  has_many :inactive_role_assignments, -> { inactive }, class_name: "RoleAssignment"
  has_many :inactive_roles, through: :inactive_role_assignments, source: :role
  has_and_belongs_to_many :groups
  has_many :departments, through: :roles
  has_many :direct_permissions, as: :grantee, class_name: "Permission"

  # Validations
  validates :email,
            uniqueness: { scope: :organization_id, allow_blank: true },
            format: { with: URI::MailTo::EMAIL_REGEXP, allow_blank: true }

  validates_non_empty_translation :name, locales: ->(member) { [ member.organization&.locale ] }

  def all_permissions
    collection = [ roles, groups, departments ]

    Permission.where(grantee: [ self, *collection ])
  end

  def is_go3_admin?
    user&.is_go3_admin?
  end

  def status
    return "archived" if self.archived?
    return "joined" if joined_at.present?
    return "invited" if invited_at.present?
    "not_invited"
  end

  def localized_status
    model_t("status.#{status}")
  end

  def has_permission?(code)
    return true if is_go3_admin?
    all_permissions.any? { |perm| perm.code == code && organization == perm.organization }
  end

  def org_admin?
    has_permission?(Permission::ORG_ADMIN)
  end
end
