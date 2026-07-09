class Organization < ApplicationRecord
  include TranslationHelper
  # Use acts_as_archival for soft delete
  acts_as_archival

  # Callbacks for archiving
  before_archive :archive_children
  after_unarchive :handle_unarchive

  # Remove default_scope and use explicit scopes for better control
  scope :active, -> { unarchived }

  # Will enable PaperTrail later
  has_paper_trail

  # Active Storage attachment
  has_one_attached :logo

  # Will enable Mobility for translations later
  extend Mobility
  translates :name, backend: :jsonb, fallbacks: true
  translates :description, backend: :jsonb, fallbacks: true

  # Associations
  belongs_to :parent, class_name: "Organization", optional: true
  belongs_to :main_currency, class_name: "Currency", optional: true
  has_many :children, class_name: "Organization", foreign_key: "parent_id", dependent: :nullify
  has_many :departments, dependent: :nullify
  has_many :groups, dependent: :nullify
  has_many :roles, dependent: :nullify
  has_many :members, dependent: :destroy
  has_many :users, through: :members
  has_many :tasks, dependent: :destroy
  has_many :currencies, dependent: :destroy
  has_many :fiscal_years, dependent: :destroy
  has_many :branches, dependent: :destroy
  has_many :account_categories, dependent: :destroy
  has_many :ledgers, through: :account_categories
  has_many :accounts, through: :ledgers
  has_many :center_types, dependent: :destroy
  has_many :centers, through: :center_types
  has_many :journal_entries, dependent: :destroy
  has_many :journal_entry_items, through: :journal_entries
  has_many :subscriptions, class_name: "G2::Subscription", dependent: :destroy
  has_many :invoices, class_name: "G2::Invoice", dependent: :destroy
  has_many :usage_records

  # Validations
  validate :no_circular_references
  validates_non_empty_translation :name, locales: ->(org) { [ org.locale ] }
  validates_uniqueness_of_translated :name, scope: :parent

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

  def trial_end_date
    created_at + G2::TRIAL_PERIOD
  end

  def trial_active?
    is_trial? && Time.current < trial_end_date
  end

  def effective_currencies
    if use_parent_org_currencies && parent.present?
      parent.effective_currencies
    else
      currencies
    end
  end

  def available_locales
    active_locales | [ locale ]
  end

  def self_and_descendant_ids
    sql = <<~SQL
      WITH RECURSIVE descendants AS (
        SELECT id FROM organizations WHERE id = ?
        UNION ALL
        SELECT o.id FROM organizations o INNER JOIN descendants d ON o.parent_id = d.id
      )
      SELECT id FROM descendants
    SQL
    Organization.find_by_sql([sql, id]).map(&:id)
  end

  def admins
    members.select(&:org_admin?).map(&:user).compact.uniq
  end

  # private

  def archive_children
    # Archive all children when this organization is archived
    children.each(&:archive)
    # Archive related entities if needed
    # departments.each(&:archive)
    # groups.each(&:archive)
    # roles.each(&:archive)
  end

  def handle_unarchive
    # You might want to implement logic to unarchive related records here
    # For now, we'll leave it up to the admin to manually restore related records
    Rails.logger.info "Organization #{id} has been restored (unarchived)"
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
