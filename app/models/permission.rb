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
end
