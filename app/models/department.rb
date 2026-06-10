class Department < ApplicationRecord
  include TranslationHelper

  has_paper_trail

  extend Mobility
  translates :name
  translates :description

  # Associations
  belongs_to :organization
  has_many :roles, dependent: :nullify
  has_many :permissions, as: :grantee, dependent: :destroy

  # Validations
  validates :abbreviation, presence: true
  validates_non_empty_translation :name, locales: ->(dept) { [ dept.organization&.locale ] }

  def members
    Member.joins(:roles).where(roles: { department_id: id }).distinct
  end

  def member_in_department?(member)
    # Find if any role associated with this department is assigned to the member
    roles.joins(:role_assignments)
         .where(role_assignments: { member_id: member.id })
         .exists?
  end

  def add_role(role)
    return if roles.include?(role)

    if role.department.present?
      role.update(department: self)
    else
      roles << role
    end
  end

  def remove_role(role)
    return unless roles.include?(role)

    role.update(department: nil)
  end
end
