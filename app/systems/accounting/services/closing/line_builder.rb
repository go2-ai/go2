# app/systems/accounting/services/closing/line_builder.rb
module Accounting
  module Closing
    # Entry lines that bring an account × centers × currency balance to zero
    # (temporary closing, ending entry) or, mirrored, re-open it (beginning
    # entry).
    #
    # A line's foreign amount is unsigned and follows its debit/credit side,
    # and every line needs a base amount. A balance whose foreign amount has
    # the opposite sign of its base amount (or has no base amount) is
    # therefore reversed with two lines:
    #
    #   1. the foreign amount, on the side it needs, with a base amount of
    #      |base| (or one smallest unit when the base amount is zero);
    #   2. the remaining base amount on the other side, without a foreign
    #      amount.
    module LineBuilder
      module_function

      # Lines whose net is −base_balance / −currency_balance of the row.
      def reversal_lines(row, main_currency_id:, digits:)
        base = row.base_balance
        foreign = row.currency_id == main_currency_id ? BigDecimal("0") : row.currency_balance
        centers = (1..6).to_h { |level| [ :"center#{level}_id", row.center_id(level) ] }
        main = row.currency_id == main_currency_id
        line = ->(signed_base, foreign_amount) { build(row, centers, signed_base, main ? nil : foreign_amount) }

        return [] if base.zero? && foreign.zero?
        return [ line.call(-base, 0) ] if foreign.zero?
        return [ line.call(-base, foreign.abs) ] if !base.zero? && base.positive? == foreign.positive?

        # Opposite signs, or a foreign amount without base amount.
        side = foreign.negative? ? 1 : -1 # the reversal's foreign side: debit (+) when foreign < 0
        carrier = side * (base.zero? ? BigDecimal(1).div(10**digits, digits) : base.abs)
        rest = -base - carrier
        [ line.call(carrier, foreign.abs), (line.call(rest, 0) unless rest.zero?) ].compact
      end

      # The same lines with debit and credit swapped.
      def mirror(lines)
        lines.map { |line| line.merge(debit: line[:credit], credit: line[:debit]) }
      end

      # foreign_amount is nil for main-currency lines (they have no foreign
      # amount, like main-currency lines entered by hand).
      def build(row, centers, signed_base, foreign_amount)
        amount = signed_base.abs
        rate = foreign_amount.nil? || foreign_amount.to_d.zero? ? nil : (amount / foreign_amount).round(15)
        {
          account_id: row.account_id, currency_id: row.currency_id, rate: rate, currency_amount: foreign_amount,
          debit: signed_base.positive? ? amount : 0, credit: signed_base.negative? ? amount : 0, **centers
        }
      end
    end
  end
end
