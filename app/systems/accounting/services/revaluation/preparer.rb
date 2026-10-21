# app/systems/accounting/services/revaluation/preparer.rb
module Accounting
  module Revaluation
    # (Re)builds the items of a draft revaluation from current balances and
    # rates. Combinations the user left out stay out. Gain/loss accounts the
    # user changed are kept while the difference keeps its sign (a gain
    # account doesn't fit a loss) and the account still fits the item.
    class Preparer
      def initialize(revaluation)
        @revaluation = revaluation
      end

      def call
        raise ArgumentError, "only drafts can be prepared" unless revaluation.draft?

        result = Builder.new(organization: revaluation.organization, as_of_date: revaluation.as_of_date,
                             scope: revaluation.scope_filter, kind: revaluation.kind, revaluation: revaluation).call

        overrides = gain_loss_overrides
        Accounting::CurrencyRevaluation.transaction do
          revaluation.fiscal_year = result.fiscal_year
          revaluation.scope = revaluation.scope_filter.to_h
          revaluation.checksum = result.checksum
          revaluation.save!
          revaluation.items.delete_all
          now = Time.current
          if result.items.any?
            rows = result.items.map do |item|
              reapply_override(item, overrides).merge(currency_revaluation_id: revaluation.id, created_at: now, updated_at: now)
            end
            Accounting::CurrencyRevaluationItem.insert_all!(rows)
          end
        end
        revaluation.items.reset
        result
      end

      private

      attr_reader :revaluation

      # key => [gain/loss account id, sign of the difference] of items whose
      # account differs from the one the builder would pick.
      def gain_loss_overrides
        items = revaluation.items.reload.to_a
        return {} if items.empty?

        fx_accounts = FxAccountResolver.new(organization: revaluation.organization).preload(items.map(&:account_id).uniq)
        items.each_with_object({}) do |item, overrides|
          next if item.difference.zero? || item.gain_loss_account_id.nil?
          next if item.gain_loss_account_id == fx_accounts.resolve(item.account_id).for_difference(item.difference)

          overrides[item.key] = [ item.gain_loss_account_id, item.difference.positive? ]
        end
      end

      def reapply_override(item, overrides)
        key = [ item[:account_id], *(1..6).map { |l| item[:"center#{l}_id"] }, item[:currency_id] ]
        account_id, positive = overrides[key]
        return item if account_id.nil? || item[:difference].zero? || item[:difference].positive? != positive
        return item if Builder::DATA_EXCLUSIONS.include?(item[:excluded_reason].to_s)

        account = Accounting::Account.find_by(id: account_id)
        return item unless account

        problem = Builder.posting_problem(item, account)
        item.merge(gain_loss_account_id: account_id, excluded: problem.present?, excluded_reason: problem)
      end
    end
  end
end
