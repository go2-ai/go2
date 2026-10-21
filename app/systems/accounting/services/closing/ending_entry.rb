# app/systems/accounting/services/closing/ending_entry.rb
require "digest"

module Accounting
  module Closing
    # Step 4: the ending entry brings every permanent (balance sheet and
    # "other" category) balance of the year to zero as of its last day, per
    # account × center1..6 × currency, keeping foreign amounts. The
    # beginning entry of the next year mirrors it.
    #
    # The temporary accounts (and the income summary) must already be zero
    # in the main currency; otherwise their balances would be lost.
    class EndingEntry
      PERMANENT_CATEGORY_TYPES = %w[balance_sheet other].freeze

      Plan = Struct.new(:lines, :open_temporary, :checksum, keyword_init: true) do
        def total
          lines.sum(BigDecimal("0")) { |line| line[:debit] }
        end

        def balanced?
          lines.sum(BigDecimal("0")) { |line| line[:debit] - line[:credit] }.zero?
        end

        def postable?
          open_temporary.empty? && balanced?
        end
      end

      def initialize(fiscal_year, member: nil)
        @fiscal_year = fiscal_year
        @member = member
      end

      def plan
        @plan ||= build_plan
      end

      # Posts the ending entry the user reviewed (checksum) and moves to the
      # beginning step.
      def post!(checksum:)
        FiscalYear.transaction do
          fiscal_year.lock!
          raise Error.new(:wrong_step) unless fiscal_year.closing? && fiscal_year.step_ending?

          @plan = nil
          raise Error.new(:stale) if checksum.blank? || checksum != plan.checksum
          raise Error.new(:temporary_accounts_open, accounts: plan.open_temporary) if plan.open_temporary.any?
          raise Error.new(:unbalanced) unless plan.balanced?

          entry = plan.lines.any? ? create_entry! : nil
          fiscal_year.update!(
            closing_step: :beginning,
            closing_data: fiscal_year.closing_data.merge(
              "ending" => { "entry_id" => entry&.id, "member_id" => member&.id, "at" => Time.current.iso8601 }
            )
          )
        end
        fiscal_year
      end

      # Deletes the ending entry (rollback from the beginning step).
      def self.destroy_entries!(fiscal_year)
        EntryWriter.destroy_entries!(fiscal_year, :ending)
      end

      private

      attr_reader :fiscal_year, :member

      def build_plan
        rows = query(category_types: PERMANENT_CATEGORY_TYPES)
        lines = rows.flat_map { |row| LineBuilder.reversal_lines(row, main_currency_id: main_currency_id, digits: digits) }
        temporary = open_temporary_rows

        Plan.new(
          lines: lines,
          open_temporary: temporary.map do |row|
            { account_id: row.account_id, center_ids: row.center_ids, currency_id: row.currency_id,
              base_balance: row.base_balance.to_s("F") }
          end,
          checksum: checksum(rows + temporary)
        )
      end

      # Income statement balances and the income summary, non-zero in the
      # main currency (foreign remainders were closed with paired lines).
      def open_temporary_rows
        rows = query(category_types: %w[income_statement])
        summary_id = fiscal_year.closing_data.dig("settings", "income_summary_account_id")
        rows += query(account_ids: [ summary_id ]) if summary_id.present?
        rows.reject { |row| row.base_balance.zero? }
      end

      def query(**filters)
        Accounting::Balances::Query.new(organization: organization, fiscal_year: fiscal_year,
                                        as_of: fiscal_year.finish_date, **filters).call
      end

      def create_entry!
        EntryWriter.create!(fiscal_year, member: member, entry_type: :ending, date: fiscal_year.finish_date,
                                         description_kind: "ending", lines: plan.lines, line_kind: "ending")
      end

      def checksum(rows)
        payload = rows.map do |row|
          [ row.account_id, *row.center_ids, row.currency_id, row.base_balance.to_s("F"), row.currency_balance.to_s("F") ].join(":")
        end.sort
        Digest::SHA256.hexdigest(payload.join("|"))
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
