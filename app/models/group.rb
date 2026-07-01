class Group < ApplicationRecord
  include TranslationHelper

  has_paper_trail

  extend Mobility
  translates :name
  translates :description

  belongs_to :organization, optional: false
  has_and_belongs_to_many :members
  has_many :permissions, as: :grantee

  before_save :sync_member_id_cache

  validates_non_empty_translation :name, locales: ->(group) { [ group.organization&.locale ] }
  validates_uniqueness_of_translated :name, scope: :organization_id

  private

  def sync_member_id_cache
    self.member_id_cache = member_ids.sort if member_ids_changed_in_memory?
  end

  def member_ids_changed_in_memory?
    member_id_cache.sort != member_ids.sort
  end
end
