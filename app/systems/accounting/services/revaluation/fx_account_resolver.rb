# app/systems/accounting/services/revaluation/fx_account_resolver.rb
module Accounting
  module Revaluation
    # FX gain and loss accounts for revaluing a monetary account, resolved
    # as account override > ledger override > accounting settings default.
    # This lets e.g. trade receivables post to operating FX results and
    # loans to non-operating ones.
    class FxAccountResolver
      Result = Struct.new(:gain_account_id, :loss_account_id, keyword_init: true) do
        # The account for a difference: gain when positive, loss when negative.
        def for_difference(difference)
          difference.positive? ? gain_account_id : loss_account_id
        end

        def complete?
          gain_account_id.present? && loss_account_id.present?
        end
      end

      def initialize(organization:)
        @organization = organization
        @cache = {}
      end

      # account: Accounting::Account or id.
      def resolve(account)
        account_id = account.respond_to?(:id) ? account.id : account
        @cache[account_id] ||= compute(account.respond_to?(:ledger) ? account : load_account(account_id))
      end

      # Loads the given accounts with their ledgers in one query.
      def preload(account_ids)
        missing = Array(account_ids).uniq - loaded_accounts.keys
        Accounting::Account.includes(:ledger).where(id: missing).each { |a| loaded_accounts[a.id] = a } if missing.any?
        self
      end

      private

      attr_reader :organization

      def loaded_accounts
        @loaded_accounts ||= {}
      end

      def load_account(account_id)
        loaded_accounts[account_id] ||= Accounting::Account.includes(:ledger).find(account_id)
      end

      def settings
        @settings ||= organization.accounting_setting
      end

      def compute(account)
        ledger = account.ledger
        Result.new(
          gain_account_id: account.fx_gain_account_id || ledger&.fx_gain_account_id || settings&.default_fx_gain_account_id,
          loss_account_id: account.fx_loss_account_id || ledger&.fx_loss_account_id || settings&.default_fx_loss_account_id
        )
      end
    end
  end
end
