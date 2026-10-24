module Accounting
  # The lines and mapping rules of a financial statement report.
  #
  # settings (all optional):
  #   statement_type     balance_sheet | income_statement | cash_flow
  #   category_types     account category types whose balances the
  #                      statement reads (others are reported, not mapped)
  #   checks             [{ "type" => "equal", "left" => key, "right" => key }]
  #   cash_flow          cash flow: { "cash_line", "opening_line", ... } (see
  #                      Statements::Runner)
  class StatementLayout < ApplicationRecord
    has_paper_trail

    belongs_to :report, class_name: "Reporting::Report", inverse_of: :statement_layout
    # Destroyed (not deleted) so paper_trail records them: rules first,
    # then the lines, deepest first (see #destroy_lines).
    has_many :rules, -> { order(:position, :id) }, class_name: "Accounting::StatementMappingRule",
             dependent: :destroy, inverse_of: :layout
    has_many :lines, -> { order(:position, :id) }, class_name: "Accounting::StatementLine", inverse_of: :layout
    before_destroy :destroy_lines

    delegate :organization, to: :report

    def statement_type
      report.statement_type
    end

    def category_types
      Array(settings["category_types"]).presence || default_category_types
    end

    def checks
      Array(settings["checks"])
    end

    private

    def default_category_types
      case statement_type
      when "income_statement" then %w[income_statement]
      else %w[balance_sheet income_statement]
      end
    end


    # The formulas go too, so lines used by formulas may be removed.
    def destroy_lines
      list = lines.to_a
      by_id = list.index_by(&:id)
      depth = ->(line) { line.parent_id && by_id[line.parent_id] ? 1 + depth.call(by_id[line.parent_id]) : 0 }
      list.sort_by { |line| -depth.call(line) }.each do |line|
        line.skip_formula_check = true
        line.destroy!
      end
    end
  end
end
