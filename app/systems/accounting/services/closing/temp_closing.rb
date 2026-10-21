# app/systems/accounting/services/closing/temp_closing.rb
require "digest"

module Accounting
  module Closing
    # Step 3: closes the temporary (income statement) accounts as of the
    # year's last day, following the method snapshotted when closing started:
    #
    #   direct              income statement → retained earnings (one entry)
    #   income_summary      income statement → income summary, then
    #                       income summary → retained earnings (two entries)
    #   current_year_profit income statement → current year profit (one entry)
    #
    # Each account × center1..6 × currency balance is reversed (see
    # LineBuilder), keeping the foreign amount so the foreign balance closes
    # too. The offsets are in the main currency, netted per combination of
    # the centers the target account allows; a balance without a center the
    # target account requires can't be closed (center_mismatch).
    class TempClosing
      CENTER_LEVELS = (1..6).freeze

      Plan = Struct.new(:closing_method, :entries, :problems, :net_result, :checksum,
                        keyword_init: true) do
        def postable?
          problems.empty?
        end
      end

      # kind: close_accounts | close_income_summary
      EntryPlan = Struct.new(:kind, :target_account_id, :lines, keyword_init: true) do
        def total
          lines.sum(BigDecimal("0")) { |line| line[:debit] }
        end
      end

      def initialize(fiscal_year, member: nil)
        @fiscal_year = fiscal_year
        @member = member
      end

      def plan
        @plan ||= build_plan
      end

      # Posts the planned entries and moves to the ending step. checksum is
      # the one of the plan the user reviewed.
      def post!(checksum:)
        FiscalYear.transaction do
          fiscal_year.lock!
          ensure_step!
          @plan = nil
          raise Error.new(:stale) if checksum.blank? || checksum != plan.checksum
          raise Error.new(:center_mismatch, problems: plan.problems) unless plan.postable?

          entries = plan.entries.map { |entry_plan| create_entry!(entry_plan) }
          fiscal_year.update!(
            closing_step: :ending,
            closing_data: fiscal_year.closing_data.merge(
              "temp_closing" => { "entry_ids" => entries.map(&:id), "member_id" => member&.id,
                                  "at" => Time.current.iso8601, "net_result" => plan.net_result.to_s("F") }
            )
          )
        end
        fiscal_year
      end

      # Deletes the temporary closing entries (rollback from the ending step).
      def self.destroy_entries!(fiscal_year)
        EntryWriter.destroy_entries!(fiscal_year, :closing_temp_accounts)
      end

      private

      attr_reader :fiscal_year, :member

      def ensure_step!
        raise Error.new(:wrong_step) unless fiscal_year.closing? && fiscal_year.step_temp_closing?
      end

      def settings
        @settings ||= fiscal_year.closing_data["settings"] || {}
      end

      def closing_method
        settings["closing_method"].to_s
      end

      def target_id
        case closing_method
        when "income_summary" then settings["income_summary_account_id"]
        when "current_year_profit" then settings["current_year_profit_account_id"]
        else settings["retained_earnings_account_id"]
        end
      end

      def build_plan
        raise Error.new(:settings_incomplete) if target_id.blank? ||
                                                 (closing_method == "income_summary" && settings["retained_earnings_account_id"].blank?)

        rows = income_statement_rows
        problems = []
        entries = []

        first = entry_plan("close_accounts", rows, account(target_id), problems)
        entries << first if first.lines.any?

        summary_rows = []
        if closing_method == "income_summary"
          summary_rows = income_summary_rows(first)
          second = entry_plan("close_income_summary", summary_rows, account(settings["retained_earnings_account_id"]),
                              problems)
          entries << second if second.lines.any?
        end

        Plan.new(
          closing_method: closing_method, entries: entries, problems: problems,
          net_result: -rows.sum(BigDecimal("0"), &:base_balance),
          checksum: checksum(rows + summary_rows)
        )
      end

      def income_statement_rows
        Accounting::Balances::Query.new(organization: organization, fiscal_year: fiscal_year,
                                        as_of: fiscal_year.finish_date, category_types: %w[income_statement]).call
      end

      # Existing income summary balances plus the offsets of the first entry.
      def income_summary_rows(first)
        existing = Accounting::Balances::Query.new(organization: organization, fiscal_year: fiscal_year,
                                                   as_of: fiscal_year.finish_date,
                                                   account_ids: [ settings["income_summary_account_id"] ]).call
        by_key = existing.index_by(&:key)
        first.lines.select { |line| line[:account_id] == target_id }.each do |line|
          centers = CENTER_LEVELS.map { |level| line[:"center#{level}_id"] }
          amount = line[:debit] - line[:credit]
          key = [ line[:account_id], *centers, main_currency_id ]
          row = by_key[key] ||= Accounting::Balances::Query::Row.new(
            account_id: line[:account_id], center_ids: centers, currency_id: main_currency_id,
            debit: BigDecimal("0"), credit: BigDecimal("0"), base_balance: BigDecimal("0"), currency_balance: BigDecimal("0")
          )
          row.base_balance += amount
          row.currency_balance += amount
        end
        by_key.values.reject(&:zero?).sort_by(&:key)
      end

      # Reverses rows and offsets them on the target account.
      def entry_plan(kind, rows, target, problems)
        reversals = []
        offsets = Hash.new { |hash, centers| hash[centers] = BigDecimal("0") }

        rows.each do |row|
          lines = LineBuilder.reversal_lines(row, main_currency_id: main_currency_id, digits: digits)
          next if lines.empty?

          centers = offset_centers(row, target)
          if centers.nil?
            problems << { reason: "center_mismatch", account_id: row.account_id, center_ids: row.center_ids,
                          currency_id: row.currency_id, target_account_id: target.id }
            next
          end

          reversals.concat(lines)
          offsets[centers] += row.base_balance
        end

        offset_lines = offsets.reject { |_, net| net.zero? }.sort_by { |centers, _| centers.map(&:to_i) }.map do |centers, net|
          {
            account_id: target.id, currency_id: main_currency_id, rate: nil, currency_amount: nil,
            debit: net.positive? ? net : 0, credit: net.negative? ? -net : 0,
            **CENTER_LEVELS.to_h { |level| [ :"center#{level}_id", centers[level - 1] ] }
          }
        end

        EntryPlan.new(kind: kind, target_account_id: target.id, lines: reversals + offset_lines)
      end

      # The row's centers at the levels the target account uses; nil when
      # the target requires a center the row doesn't have.
      def offset_centers(row, target)
        CENTER_LEVELS.map do |level|
          next nil if target.public_send("allowed_center_types_#{level}").blank?

          center = row.center_id(level)
          return nil if center.nil?

          center
        end
      end

      def create_entry!(entry_plan)
        EntryWriter.create!(
          fiscal_year, member: member, entry_type: :closing_temp_accounts, date: fiscal_year.finish_date,
          description_kind: entry_plan.kind, lines: entry_plan.lines,
          line_kind: ->(line) { line[:account_id] == entry_plan.target_account_id ? "closing_offset" : "closing" }
        )
      end

      def checksum(rows)
        payload = rows.map do |row|
          [ row.account_id, *row.center_ids, row.currency_id, row.base_balance.to_s("F"), row.currency_balance.to_s("F") ].join(":")
        end.sort
        Digest::SHA256.hexdigest([ closing_method, target_id, settings["retained_earnings_account_id"], *payload ].join("|"))
      end

      def account(id)
        @accounts ||= {}
        @accounts[id] ||= Accounting::Account.find_by(id: id) || raise(Error.new(:settings_incomplete))
      end

      def organization
        fiscal_year.organization
      end

      def main_currency_id
        @main_currency_id ||= organization.accounting_setting.main_currency_id
      end

      def digits
        @digits ||= organization.accounting_setting.main_currency&.decimal_digits || 2
      end
    end
  end
end
