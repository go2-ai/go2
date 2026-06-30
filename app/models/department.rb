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
    Member.where(id: roles.pluck(&:member_id))
  end

  def member_in_department?(member)
    roles.where(member_id: member.id).exists?
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
