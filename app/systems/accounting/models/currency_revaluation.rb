# app/systems/accounting/models/currency_revaluation.rb
module Accounting
  # Revaluation of foreign currency balances of monetary accounts to the
  # exchange rates of a date. The revaluation entry (type `revaluation`) is
  # linked through JournalEntry#source.
  #
  # temporary: replaced by the next revaluation that overlaps it (its entry
  #            is deleted and the revaluation marked superseded).
  # permanent: kept; later revaluations add only the incremental difference.
  class CurrencyRevaluation < ApplicationRecord
    include TranslationHelper
    has_paper_trail

    extend Mobility
    translates :description

    enum :kind, { temporary: 0, permanent: 1 }
    enum :status, { draft: 0, posted: 1, superseded: 2 }

    belongs_to :organization
    belongs_to :fiscal_year
    belongs_to :created_by, class_name: "Member", optional: true
    belongs_to :posted_by, class_name: "Member", optional: true
    belongs_to :schedule, class_name: "Accounting::CurrencyRevaluationSchedule", optional: true, inverse_of: :revaluations
    has_many :items, -> { order(:id) }, class_name: "Accounting::CurrencyRevaluationItem",
             inverse_of: :currency_revaluation, dependent: :delete_all
    has_one :journal_entry, class_name: "Accounting::JournalEntry", as: :source

    validates :as_of_date, presence: true
    validate :as_of_date_within_fiscal_year
    validate :line_templates_valid

    scope :effective, -> { where(status: :posted) }

    def scope_filter
      Accounting::Revaluation::Scope.new(scope)
    end

    # Items that are (or would be) posted.
    def postable_items
      items.select(&:postable?)
    end

    # Combinations the user left out (see CurrencyRevaluationItem#key).
    def removed_key_set
      keys = removed_keys
      return @removed_key_set if @removed_key_set && @removed_key_set_for.equal?(keys)

      @removed_key_set_for = keys
      @removed_key_set = Array(keys).to_set
    end

    private

    def line_templates_valid
      Accounting::Revaluation::LineDescriptions.validate(self, :line_description_template, line_description_template, "item")
      Accounting::Revaluation::LineDescriptions.validate(self, :counter_line_description_template,
                                                         counter_line_description_template, "counter")
    end

    def as_of_date_within_fiscal_year
      return if as_of_date.blank? || fiscal_year.blank?
      return if as_of_date.between?(fiscal_year.start_date, fiscal_year.finish_date)

      errors.add(:as_of_date, model_t("errors.outside_fiscal_year"))
    end
  end
end
