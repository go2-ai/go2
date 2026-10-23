# app/systems/accounting/services/explorer/print_data.rb
module Accounting
  module Explorer
    # Data of the explorer and journal entry items prints: the `root` of
    # their templates. Both describe what was printed (period, entry types,
    # states and the drill filters, with the names of the filtered records)
    # and carry the organization's main currency.
    #
    # Names and labels come in the current locale: render inside the
    # template's locale (see PrintLocale).
    class PrintData
      LABEL_SCOPE = "reports.shared".freeze

      def initialize(organization:, scope:, filters: [])
        @organization = organization
        @scope = scope
        @filters = filters || []
      end

      # rows: GroupedSummaryQuery rows.
      def explorer(group_by:, rows:, hide_zero_balance: false)
        sum = ->(key) { rows.sum { |row| row[key].to_f } }

        header.merge(
          group_by: group_by,
          group_by_name: dimension_name(group_by),
          hide_zero_balance: hide_zero_balance,
          total_debit: sum.call(:sum_debit),
          total_credit: sum.call(:sum_credit),
          total_debit_balance: sum.call(:debit_balance),
          total_credit_balance: sum.call(:credit_balance),
          rows: rows.map { |row| row.slice(:code, :name, :sum_debit, :sum_credit, :debit_balance, :credit_balance) }
        )
      end

      # items: an ItemsQuery relation (with its includes).
      def items(items)
        rows = items.map { |item| item_row(item) }

        header.merge(
          total_debit: rows.sum { |row| row[:debit] },
          total_credit: rows.sum { |row| row[:credit] },
          items: rows
        )
      end

      private

      attr_reader :organization, :scope, :filters

      def header
        {
          organization_name: organization.name,
          from: scope.from.iso8601,
          to: scope.to.iso8601,
          entry_types: scope.entry_types,
          entry_types_text: entry_types_text,
          approved_only: scope.approved_only,
          states_text: label(scope.approved_only ? "states_names.approved" : "states_names.booked_and_approved"),
          filters: filter_rows,
          currency: main_currency
        }
      end

      def item_row(item)
        entry = item.journal_entry
        {
          date: entry.date&.iso8601,
          no: entry.no,
          ref: entry.ref,
          row: item.row,
          account_code: item.account&.full_code,
          account_name: item.account&.name,
          centers: (1..6).filter_map do |level|
            center = item.public_send("center#{level}")
            [ center.code, center.name ].compact_blank.join(" ") if center
          end.join(" / "),
          description: item.description,
          debit: item.debit.to_f,
          credit: item.credit.to_f,
          currency: item.currency&.abr,
          currency_amount: item.currency_amount&.to_f,
          rate: item.rate&.to_f
        }
      end

      def entry_types_text
        types = scope.entry_types | (scope.include_year_end ? EntryScope::YEAR_END_TYPES : [])
        types.sort_by { |type| EntryScope::ENTRY_TYPES.index(type) || 99 }
             .map { |type| label("entry_types_names.#{type}") }
             .join(label("separator"))
      end

      # One row per drill filter: { dimension, dimension_name, items_text }.
      def filter_rows
        filters.filter_map do |filter|
          dimension = filter[:dimension].to_s
          ids = Array(filter[:ids])
          next if ids.empty?

          records = records_for(dimension, ids)
          {
            dimension: dimension,
            dimension_name: dimension_name(dimension),
            items_text: records.map { |record| [ code_for(record, dimension), record.name ].compact_blank.join(" ") }.join(label("separator"))
          }
        end
      end

      def records_for(dimension, ids)
        relation = case dimension
        when "account_category" then Accounting::AccountCategory.where(id: ids)
        when "ledger" then Accounting::Ledger.where(id: ids).includes(:account_category)
        when "account" then Accounting::Account.where(id: ids).includes(ledger: :account_category)
        when "currency" then Accounting::Currency.where(id: ids)
        when /\Acenter[1-6]\z/ then Accounting::Center.where(id: ids)
        end
        records = relation ? relation.to_a : []
        records.sort_by { |record| code_for(record, dimension).to_s }
      end

      def code_for(record, dimension)
        case dimension
        when "currency" then record.abr
        when "ledger", "account" then record.full_code
        else record.code
        end
      end

      def dimension_name(dimension)
        label("dimensions.#{dimension}")
      end

      def main_currency
        currency = organization.accounting_setting&.main_currency
        return nil unless currency

        {
          abr: currency.abr,
          name: currency.name,
          names: currency.read_attribute(:name) || {},
          decimal_digits: currency.decimal_digits
        }
      end

      def label(key)
        I18n.t("#{LABEL_SCOPE}.#{key}")
      end
    end
  end
end
