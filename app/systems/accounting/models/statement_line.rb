module Accounting
  # A line of a financial statement.
  #
  # kind:
  #   heading  a caption; has no amount of its own
  #   mapped   the balances its rules map to it, plus its children
  #   formula  computed from other lines, e.g. "revenue + cost_of_sales"
  #
  # normal_side: the side the amount is shown on. The value of a line is
  # its balance on that side, so with credit-normal profit or loss lines
  # expenses show as negative amounts and formulas simply add lines.
  #
  # style: { "bold" => true, "underline" => true, "hide_if_zero" => true }
  # metadata: e.g. { "ifrs18_category" => "operating" }
  class StatementLine < ApplicationRecord
    include TranslationHelper
    has_paper_trail

    extend Mobility
    translates :label

    KEY_FORMAT = /\A[a-z][a-z0-9_]*\z/

    enum :kind, { heading: 0, mapped: 1, formula: 2 }, validate: true
    enum :normal_side, { debit: 0, credit: 1 }, prefix: :normal, validate: true
    FORMULA_MAX_LENGTH = 1000
    belongs_to :layout, class_name: "Accounting::StatementLayout", foreign_key: :statement_layout_id,
                        inverse_of: :lines
    belongs_to :parent, class_name: "Accounting::StatementLine", optional: true
    has_many :children, -> { order(:position, :id) }, class_name: "Accounting::StatementLine",
             foreign_key: :parent_id, dependent: :destroy, inverse_of: :parent
    has_many :rules, class_name: "Accounting::StatementMappingRule", dependent: :destroy,
                     inverse_of: :line

    validates :key, presence: true, format: { with: KEY_FORMAT },
                    uniqueness: { scope: :statement_layout_id }
    validates :formula, presence: true, if: :formula?
    validates :formula, length: { maximum: FORMULA_MAX_LENGTH }
    validate :formula_is_valid, if: -> { formula? && formula.present? }
    validate :parent_in_same_layout
    # Set when the whole layout is destroyed (its formulas go too).
    attr_accessor :skip_formula_check

    # Formulas and ratios refer to lines by key.
    attr_readonly :key
    before_destroy :ensure_not_used_in_formulas

    # Line keys a formula reads.
    def formula_dependencies
      return [] unless formula? && formula.present?

      Accounting::Statements::Formula.dependencies(formula)
    end

    # Formula lines of the layout that read this line.
    def dependent_lines
      layout.lines.select { |line| line.id != id && line.formula_dependencies.include?(key) }
    end

    private

    def ensure_not_used_in_formulas
      return if skip_formula_check
      users = dependent_lines
      return if users.empty?

      errors.add(:key, model_t("errors.key_in_use", lines: users.map(&:label).join(", ")))
      throw :abort
    end

    def formula_is_valid
      error = Accounting::Statements::Formula.syntax_error(formula)
      errors.add(:formula, model_t("errors.invalid_formula", detail: error)) if error
    end

    # The parent must be a line of the same layout and not the line itself
    # or one of its descendants (that would make a cycle).
    def parent_in_same_layout
      return if parent.nil?

      errors.add(:parent, :invalid) if parent.statement_layout_id != statement_layout_id || ancestor_or_self?(parent)
    end

    def ancestor_or_self?(candidate)
      return candidate == self if new_record?

      seen = Set.new
      line = candidate
      while line
        return true if line.id == id
        break unless seen.add?(line.id)

        line = line.parent
      end
      false
    end
  end
end
