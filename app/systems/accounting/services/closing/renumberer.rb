# app/systems/accounting/services/closing/renumberer.rb
module Accounting
  module Closing
    # Optional step right after closing starts: gives the year's entries
    # consecutive numbers (`no`) in the order
    #
    #   date, then type (beginning, other entries, closing of temporary
    #   accounts, ending), then creation time.
    #
    # References (`ref`) don't change. Entries posted later in the closing
    # (revaluations, closing entries) get the next numbers, which keeps the
    # order since they are dated on the last day.
    class Renumberer
      TYPE_ORDER = { "beginning" => 0, "closing_temp_accounts" => 2, "ending" => 3 }.freeze
      OTHER_TYPES = 1
      # Changes listed in the preview; renumbering itself has no limit.
      PREVIEW_LIMIT = 500

      Change = Struct.new(:id, :ref, :date, :entry_type, :no, :new_no, keyword_init: true)
      Plan = Struct.new(:entries_count, :changes, keyword_init: true)

      def initialize(fiscal_year, member: nil)
        @fiscal_year = fiscal_year
        @member = member
      end

      def plan
        entries = fiscal_year.journal_entries.select(:id, :no, :ref, :date, :entry_type, :created_at).to_a
        ordered = entries.sort_by { |e| [ e.date, TYPE_ORDER.fetch(e.entry_type, OTHER_TYPES), e.created_at, e.id ] }
        changes = ordered.each_with_index.filter_map do |entry, index|
          new_no = (index + 1).to_s
          next if entry.no == new_no

          Change.new(id: entry.id, ref: entry.ref, date: entry.date, entry_type: entry.entry_type, no: entry.no, new_no: new_no)
        end
        Plan.new(entries_count: entries.size, changes: changes)
      end

      # Renumbers and moves on to the revaluation step.
      def renumber!
        finish do
          changes = plan.changes
          entries = fiscal_year.journal_entries.where(id: changes.map(&:id)).index_by(&:id)
          # Numbers are unique per year, but nothing enforces it in the
          # database, so the swap can be done entry by entry. Versions keep
          # the old numbers in the change log.
          changes.each { |change| entries.fetch(change.id).paper_trail.update_columns(no: change.new_no) }
          { "renumbered" => changes.size }
        end
      end

      def skip!
        finish { { "skipped" => true } }
      end

      private

      attr_reader :fiscal_year, :member

      def finish
        FiscalYear.transaction do
          fiscal_year.lock!
          raise Error.new(:wrong_step) unless fiscal_year.closing? && fiscal_year.step_renumber?

          result = yield
          fiscal_year.update!(
            closing_step: :revaluation,
            closing_data: fiscal_year.closing_data.merge(
              "renumber" => result.merge("member_id" => member&.id, "at" => Time.current.iso8601)
            )
          )
        end
        fiscal_year
      end
    end
  end
end
