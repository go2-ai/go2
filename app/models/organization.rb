class Organization < ApplicationRecord
  include TranslationHelper
  # Use acts_as_archival for soft delete
  acts_as_archival

  # Callbacks for archiving
  before_archive :archive_children
  after_unarchive :handle_unarchive

  # Remove default_scope and use explicit scopes for better control
  scope :active, -> { unarchived }

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
  has_many :permissions, dependent: :destroy
  has_many :fiscal_years, dependent: :destroy
  has_many :documents, dependent: :destroy
  has_many :report_templates, dependent: :destroy

  has_many :currencies, class_name: "Accounting::Currency", dependent: :destroy
  has_many :center_types, class_name: "Accounting::CenterType", dependent: :destroy
  has_many :centers, through: :center_types, class_name: "Accounting::Center"
  has_one :accounting_setting, class_name: "Accounting::Setting", dependent: :destroy
  has_many :account_categories, class_name: "Accounting::AccountCategory", dependent: :destroy
  has_many :ledgers, through: :account_categories, class_name: "Accounting::Ledger"
  has_many :accounts, through: :ledgers, class_name: "Accounting::Account"
  has_many :journal_entries, class_name: "Accounting::JournalEntry", dependent: :destroy

  # Validations
  validate :no_circular_references
  validates_non_empty_translation :name, locales: ->(org) { [ org.locale ] }
  validates_uniqueness_of_translated :name, scope: :parent, if: -> { parent_id.present? }
  validate :at_least_one_calendar_type



  after_create :create_default_accounting_setting!

  def create_default_accounting_setting!
    create_accounting_setting!
    currency = currencies.create!(name: "US Dollar", abr: "USD", decimal_digits: 2) if currencies.empty?
    accounting_setting.update!(main_currency: currency)
    create_system_account_categories!
  end

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

  TRIAL_DAYS = 15

  def trial_end_date
    created_at + TRIAL_DAYS.days
  end

  def trial_active?
    trial_end_date > Date.current
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

  def create_system_account_categories!
    Accounting::AccountCategory.system_categories.each do |cat|
      category = Accounting::AccountCategory.create(
        organization: self,
        name: cat[:name],
        code: cat[:code],
        type: cat[:type],
        identifier: cat[:identifier]
      )
    end
  end

  def default_calendar_type
    calendar_types.first
  end

  def total_file_size_mb
    (total_file_size.to_f / 1.megabyte).round(2)
  end

  def total_file_size_gb
    (total_file_size.to_f / 1.gigabyte).round(2)
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

  def at_least_one_calendar_type
    if calendar_types.blank?
      errors.add(:calendar_types, model_t("errors.at_least_one_calendar_type"))
    end
  end
end
