module Accounting
  # Maps balances to a statement line.
  #
  # selector_type and selector:
  #   category        { "identifiers" => ["CA"], "ids" => [1] }
  #   ledger          { "ids" => [3] }
  #   account         { "ids" => [7], "settings" => ["retained_earnings_account_id"] }
  #                   (settings: accounts named in the accounting settings)
  #   account_range   { "from" => "11", "to" => "12" } on the account's full code:
  #                   codes whose first characters fall in the range
  #   profit_or_loss  { "period" => "prior" | "current" } income statement
  #                   balances posted before / within the current fiscal year
  #                   (balance sheet: retained earnings and profit for the year)
  #
  # center_level with center_ids / center_type_ids, and currency_ids,
  # narrow a rule further.
  #
  # opposite_line: when set, balances whose sign is opposite to the line's
  # normal side go there instead, judged per `grain` (e.g. per customer
  # with "account_center1", or netted per account with "account").
  #
  # Precedence: the highest priority wins (blank = 0), then the most
  # specific selector; rules equal on both conflict.
  class StatementMappingRule < ApplicationRecord
    include TranslationHelper
    has_paper_trail

    enum :selector_type, { category: 0, ledger: 1, account: 2, account_range: 3, profit_or_loss: 4 }, validate: true
    GRAINS = [ "account", "row", "account_currency", *(1..6).map { |level| "account_center#{level}" } ].freeze
    MEASURES = %w[balance change debit_movement credit_movement].freeze
    SETTING_ACCOUNTS = %w[retained_earnings_account_id income_summary_account_id current_year_profit_account_id].freeze
    PERIODS = %w[prior current].freeze

    SPECIFICITY = { "profit_or_loss" => 10, "category" => 10, "ledger" => 20, "account_range" => 30, "account" => 40 }.freeze

    belongs_to :layout, class_name: "Accounting::StatementLayout", foreign_key: :statement_layout_id,
                        inverse_of: :rules
    belongs_to :line, class_name: "Accounting::StatementLine", foreign_key: :statement_line_id, inverse_of: :rules
    belongs_to :opposite_line, class_name: "Accounting::StatementLine", optional: true

    validates :grain, inclusion: { in: GRAINS }
    validates :measure, inclusion: { in: MEASURES }
    validates :center_level, inclusion: { in: 1..6 }, allow_nil: true
    validate :center_filters_need_level
    validate :lines_belong_to_layout
    validate :selector_is_valid
    validate :references_belong_to_organization
    validate :no_equal_overlapping_rule, unless: :skip_overlap_check

    # Proposed rule sets are checked as a whole (see Statements::ProposedRules).
    attr_accessor :skip_overlap_check

    # Higher wins when priorities are equal. Center and currency filters
    # make a rule more specific than the same rule without them.
    def specificity
      SPECIFICITY.fetch(selector_type) + (center_filter? ? 2 : 0) + (currency_ids.any? ? 1 : 0)
    end

    def effective_priority
      priority || 0
    end

    def center_filter?
      center_level.present? && (center_ids.any? || center_type_ids.any?)
    end

    # Another rule of the layout that matches some of the same balances
    # with the same priority and specificity (the engine couldn't choose).
    def equal_overlapping_rule
      return nil if layout.nil?

      layout.rules.where.not(id: id).find do |other|
        other.selector_type == selector_type && other.effective_priority == effective_priority &&
          other.center_level == center_level && other.center_ids.sort == center_ids.sort &&
          other.center_type_ids.sort == center_type_ids.sort && other.currency_ids.sort == currency_ids.sort &&
          selectors_overlap?(other.selector.to_h, selector.to_h)
      end
    end

    private

    def no_equal_overlapping_rule
      other = equal_overlapping_rule
      errors.add(:base, model_t("errors.overlapping_rule", line: other.line&.label)) if other
    end

    def selectors_overlap?(a, b)
      case selector_type
      when "account_range"
        a["from"].to_s.length == b["from"].to_s.length && a["from"].to_s <= b["to"].to_s && b["from"].to_s <= a["to"].to_s
      when "profit_or_loss"
        a["period"] == b["period"]
      else
        %w[ids identifiers settings].any? { |key| (Array(a[key]).map(&:to_s) & Array(b[key]).map(&:to_s)).any? }
      end
    end

    def center_filters_need_level
      return if center_level.present? || (center_ids.empty? && center_type_ids.empty?)

      errors.add(:center_level, :blank)
    end

    def lines_belong_to_layout
      errors.add(:line, :invalid) if line && line.statement_layout_id != statement_layout_id
      errors.add(:line, :invalid) if line&.heading?
      if opposite_line && (opposite_line.statement_layout_id != statement_layout_id || opposite_line == line)
        errors.add(:opposite_line, :invalid)
      end
    end

    # Selector, center and currency ids must be records of the report's
    # organization (system presets name categories by identifier only).
    def references_belong_to_organization
      organization = layout&.organization
      return if organization.nil?

      ids = Array(selector.to_h["ids"]).map(&:to_i)
      known = case selector_type
      when "category" then organization.account_categories.where(id: ids).count
      when "ledger" then Accounting::Ledger.joins(:account_category).where(id: ids, account_categories: { organization_id: organization.id }).count
      when "account" then Accounting::Account.joins(ledger: :account_category).where(id: ids, account_categories: { organization_id: organization.id }).count
      else ids.size
      end
      errors.add(:selector, :invalid) if known != ids.uniq.size
      foreign = {
        center_ids: Accounting::Center.joins(:center_type).where(center_types: { organization_id: organization.id }),
        center_type_ids: organization.center_types,
        currency_ids: organization.currencies
      }
      foreign.each do |attribute, scope|
        values = Array(public_send(attribute)).map(&:to_i).uniq
        errors.add(attribute, :invalid) if values.any? && scope.where(id: values).count != values.size
      end
    end

    def selector_is_valid
      data = selector || {}
      valid = case selector_type
      when "category"
        Array(data["identifiers"]).any? || Array(data["ids"]).any?
      when "ledger"
        Array(data["ids"]).any?
      when "account"
        Array(data["ids"]).any? || Array(data["settings"]).any?
      when "account_range"
        data["from"].present? && data["to"].present? && data["from"].to_s.length == data["to"].to_s.length &&
          data["from"].to_s <= data["to"].to_s
      when "profit_or_loss"
        PERIODS.include?(data["period"])
      else
        false
      end
      valid &&= (Array(data["settings"]) - SETTING_ACCOUNTS).empty? if selector_type == "account"
      errors.add(:selector, :invalid) unless valid
    end
  end
end
