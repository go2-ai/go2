# app/systems/accounting/services/revaluation/poster.rb
module Accounting
  module Revaluation
    # Posts a draft revaluation: re-checks that balances and rates haven't
    # changed since the preview, supersedes overlapping temporary
    # revaluations and creates the approved `revaluation` entry.
    #
    # Entry lines:
    #   - per item: the monetary account (its centers and currency), debit
    #     for a positive difference, credit for a negative one; only the
    #     main-currency amount changes, so currency_amount is 0 and the
    #     rate is empty;
    #   - per gain/loss account and the centers it allows: the net of the
    #     differences, in the main currency (credit = gain, debit = loss).
    #
    # Line descriptions come from the templates (LineDescriptions).
    # Combinations the user left out are not posted.
    class Poster
      def initialize(revaluation, member:)
        @revaluation = revaluation
        @member = member
      end

      def call
        raise Builder::Error.new(:not_draft) unless revaluation.draft?

        Accounting::CurrencyRevaluation.transaction do
          FiscalYear.lock.find(revaluation.fiscal_year_id)

          result = Builder.new(organization: organization, as_of_date: revaluation.as_of_date,
                               scope: revaluation.scope_filter, kind: revaluation.kind, revaluation: revaluation).call
          raise Builder::Error.new(:stale) if result.checksum != revaluation.checksum

          items = revaluation.items.reload.includes(:gain_loss_account).to_a
          check_items!(items)
          postable = items.select(&:postable?)
          raise Builder::Error.new(:nothing_to_post) if postable.empty?

          Superseder.new(result.superseded).call
          create_entry!(postable)
          revaluation.update!(status: :posted, posted_at: Time.current, posted_by: member)
        end
        revaluation
      end

      private

      attr_reader :revaluation, :member

      def organization
        revaluation.organization
      end

      def check_items!(items)
        problems = items.select(&:postable?).filter_map do |item|
          problem = Builder.posting_problem(item.attributes.symbolize_keys, item.gain_loss_account)
          problem && { item_id: item.id, reason: problem }
        end
        raise Builder::Error.new(:items_not_postable, items: problems) if problems.any?
      end

      def create_entry!(items)
        entry = Accounting::JournalEntry.new(
          organization: organization,
          fiscal_year: revaluation.fiscal_year,
          date: revaluation.as_of_date,
          entry_type: :revaluation,
          state: :approved,
          source: revaluation,
          creator: member,
          approved_by: member,
          approved_at: Time.current,
          system_context: Remover::SYSTEM_CONTEXT
        )
        entry.write_attribute(:description, description)
        lines(items).each_with_index do |line, index|
          description = line.delete(:description)
          entry.items.build(line.merge(row: index + 1)).write_attribute(:description, description)
        end

        return entry if entry.save

        raise Builder::Error.new(:entry_invalid, messages: entry.errors.full_messages)
      end

      def lines(items)
        monetary = items.map do |item|
          amount = item.difference.abs
          {
            account_id: item.account_id,
            currency_id: item.currency_id,
            # Only the main-currency amount changes, so the line has no
            # foreign amount and no rate (the rate is on the revaluation).
            rate: nil,
            currency_amount: 0,
            debit: item.difference.positive? ? amount : 0,
            credit: item.difference.negative? ? amount : 0,
            description: line_descriptions.item(item),
            **(1..6).to_h { |level| [ :"center#{level}_id", item.public_send("center#{level}_id") ] }
          }
        end

        monetary + counter_lines(items)
      end

      # Net differences per gain/loss account and the centers it allows.
      def counter_lines(items)
        totals = Hash.new { |hash, key| hash[key] = BigDecimal("0") }
        items.each do |item|
          account = item.gain_loss_account
          centers = (1..6).map do |level|
            account.public_send("allowed_center_types_#{level}").present? ? item.public_send("center#{level}_id") : nil
          end
          totals[[ account.id, *centers ]] += item.difference
        end

        totals.reject { |_, net| net.zero? }.sort_by(&:first).map do |(account_id, *centers), net|
          {
            account_id: account_id,
            currency_id: main_currency_id,
            rate: nil,
            currency_amount: nil,
            debit: net.negative? ? -net : 0,
            credit: net.positive? ? net : 0,
            description: line_descriptions.counter(account_id, centers, net),
            **(1..6).to_h { |level| [ :"center#{level}_id", centers[level - 1] ] }
          }
        end
      end

      def line_descriptions
        @line_descriptions ||= LineDescriptions.new(revaluation)
      end

      def main_currency_id
        organization.accounting_setting.main_currency_id
      end

      def description
        organization.entry_locales.to_h do |locale|
          [ locale, Accounting::CurrencyRevaluation.model_t("entry_description",
                                                                 date: revaluation.as_of_date.iso8601, locale: locale) ]
        end
      end
    end
  end
end
