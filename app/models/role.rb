class Role < ApplicationRecord
  include TranslationHelper
  # Will enable PaperTrail later
  has_paper_trail

  # Will enable Mobility for translations later
  extend Mobility
  translates :name, backend: :jsonb, fallbacks: true
  translates :description, backend: :jsonb, fallbacks: true

  # Ensure name is always initialized as a hash
  after_initialize :initialize_name
  before_validation :initialize_name

  # Associations
  belongs_to :organization, optional: false
  belongs_to :department, optional: true
  belongs_to :member, optional: true
  belongs_to :parent, class_name: "Role", optional: true
  has_many :children, class_name: "Role", foreign_key: "parent_id"
  has_many :permissions, as: :grantee

  # Validations
  validates_non_empty_translation :name, locales: ->(role) { [ role.organization&.locale ] }
  validate :no_circular_references

  # Scopes
  scope :active, -> { where(active: true) }

  # Methods
  def ancestors
    chain = [ self ]
    current = self

    while current.parent.present?
      current = current.parent
      chain << current
    end

    chain
  end

  def descendants
    chain = [ self ]
    current = self
    while current.children.present?
      current.children.each do |child|
        chain << child
        chain.concat(child.descendants)
      end
      current = current.children.first
    end
    chain.uniq
  end

  private

  def initialize_name
    write_attribute(:name, {}) if read_attribute(:name).nil?
  end

  def name_has_at_least_one_translation
    return if Mobility.available_locales.any? { |loc| name(locale: loc).present? }
    errors.add(:name, "must contain at least one translation")
  end

  def no_circular_references
    return unless parent_id_changed? && parent_id.present?

    current_parent = parent
    while current_parent.present?
      if current_parent.id == id
        errors.add(:parent_id, "circular reference detected")
        break
      end
      current_parent = current_parent.parent
    end
  end
end
