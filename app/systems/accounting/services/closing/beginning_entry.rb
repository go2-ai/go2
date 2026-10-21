# app/systems/accounting/services/closing/beginning_entry.rb
module Accounting
  module Closing
    # Step 5: the beginning entry of the next fiscal year mirrors the ending
    # entry (debit ↔ credit, same accounts, centers, currencies and foreign
    # amounts) on the next year's first day, and the year is closed.
    #
    # Blockers:
    #   next_fiscal_year_missing / next_fiscal_year_not_open
    #   beginning_entry_exists        a beginning entry from this year already exists
    #   manual_beginning_entries      the next year has beginning entries made by
    #                                 hand (they would carry the balances twice)
    #   next_year_permanent_revaluations  the next year has posted permanent
    #                                 revaluations, built without these balances
    class BeginningEntry
      PREFERRED_NO = "1".freeze

      Plan = Struct.new(:next_fiscal_year, :lines, :blockers, :manual_beginning_entries,
                        :permanent_revaluations, keyword_init: true) do
        def total
          lines.sum(BigDecimal("0")) { |line| line[:debit] }
        end

        def postable?
          blockers.empty?
        end
      end

      def initialize(fiscal_year, member: nil)
        @fiscal_year = fiscal_year
        @member = member
      end

      def plan
        @plan ||= build_plan
      end

      # Posts the beginning entry and closes the year.
      def post!
        FiscalYear.transaction do
          fiscal_year.lock!
          raise Error.new(:wrong_step) unless fiscal_year.closing? && fiscal_year.step_beginning?

          next_year&.lock!
          @plan = nil
          raise Error.new(:beginning_blocked, blockers: plan.blockers) unless plan.postable?

          entry = plan.lines.any? ? create_entry! : nil
          fiscal_year.update!(
            status: :closed, closing_step: :finalized, closed_at: Time.current, closed_by: member,
            closing_data: fiscal_year.closing_data.merge(
              "beginning" => { "entry_id" => entry&.id, "fiscal_year_id" => next_year.id, "member_id" => member&.id,
                               "at" => Time.current.iso8601 }
            )
          )
        end
        fiscal_year
      end

      # Deletes the beginning entry (reopening the year).
      def self.destroy_entries!(fiscal_year)
        EntryWriter.destroy_entries!(fiscal_year, :beginning)
      end

      private

      attr_reader :fiscal_year, :member

      def next_year
        @next_year ||= fiscal_year.closing_next_fiscal_year
      end

      def build_plan
        manual = []
        permanents = []
        blockers = []

        if next_year.nil?
          blockers << "next_fiscal_year_missing"
        else
          blockers << "next_fiscal_year_not_open" unless next_year.open?
          blockers << "beginning_entry_exists" if fiscal_year.closing_entries.where(entry_type: :beginning).exists?

          manual = next_year.journal_entries.where(entry_type: :beginning, source_id: nil).order(:date, :id).to_a
          blockers << "manual_beginning_entries" if manual.any?

          permanents = Accounting::CurrencyRevaluation.where(fiscal_year: next_year, status: :posted, kind: :permanent)
                                                      .order(:as_of_date).to_a
          blockers << "next_year_permanent_revaluations" if permanents.any?
        end

        Plan.new(next_fiscal_year: next_year, lines: lines, blockers: blockers,
                 manual_beginning_entries: manual, permanent_revaluations: permanents)
      end

      # The ending entry's lines, mirrored.
      def lines
        ending = fiscal_year.closing_entries.find_by(entry_type: :ending)
        return [] unless ending

        LineBuilder.mirror(ending.items.order(:row).map do |item|
          {
            account_id: item.account_id, currency_id: item.currency_id, rate: item.rate,
            currency_amount: item.currency_amount, debit: item.debit, credit: item.credit,
            **(1..6).to_h { |level| [ :"center#{level}_id", item.public_send("center#{level}_id") ] }
          }
        end)
      end

      def create_entry!
        EntryWriter.create!(fiscal_year, member: member, entry_type: :beginning, fiscal_year: next_year,
                                         date: next_year.start_date, no: preferred_no,
                                         description_kind: "beginning", lines: plan.lines, line_kind: "beginning")
      end

      # Beginning entries are usually number 1 of the year.
      def preferred_no
        next_year.journal_entries.exists?(no: PREFERRED_NO) ? nil : PREFERRED_NO
      end
    end
  end
end
