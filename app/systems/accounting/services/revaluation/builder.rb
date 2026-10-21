# app/systems/accounting/services/revaluation/builder.rb
require "digest"

module Accounting
  module Revaluation
    # Computes the items of a revaluation as of a date: for each monetary
    # account × center1..6 × foreign currency balance in scope,
    #
    #   revalued   = round(currency_balance × rate, main currency digits)
    #   difference = revalued − book base balance
    #
    # Book balances are booked + approved entries of the fiscal year up to
    # the date, without the entries of posted temporary revaluations (they
    # are replaced). Posted permanent revaluations stay in the book
    # balances, so a new revaluation adds only the incremental difference.
    #
    # Temporary revaluations whose items overlap the scope are superseded
    # when posting; combinations they covered outside the scope are
    # recomputed too, so nothing they revalued is lost.
    class Builder
      class Error < StandardError
        attr_reader :key, :details

        def initialize(key, **details)
          @key = key
          @details = details
          super(key.to_s)
        end
      end

      Result = Struct.new(:fiscal_year, :items, :superseded, :checksum, keyword_init: true)

      # Exclusions that come from the data (not from account settings);
      # part of the checksum.
      DATA_EXCLUSIONS = %w[missing_rate blocked_by_unapproved locked_by_permanent].freeze

      # kind :permanent additionally excludes combinations that have draft or
      # booked entries dated on or before the date (they must be approved
      # first, since the balance gets locked).
      #
      # For both kinds, combinations locked by a posted permanent revaluation
      # dated on or after this date are excluded.
      def initialize(organization:, as_of_date:, scope:, kind: :temporary, revaluation: nil)
        @organization = organization
        @as_of_date = as_of_date
        @scope = scope.is_a?(Scope) ? scope : Scope.new(scope)
        @kind = kind.to_s
        @revaluation = revaluation
      end

      def call
        fiscal_year = find_fiscal_year!
        temporaries = posted_temporaries(fiscal_year)
        superseded = temporaries.select { |t| overlaps?(t) }
        carried_keys = superseded.flat_map { |t| t.items.map(&:key) }.to_set

        rows = balance_rows(fiscal_year, temporaries, carried_keys)
        unapproved = kind == "permanent" ? unapproved_keys(fiscal_year, rows) : Set.new
        items = rows.map { |row| build_item(row, unapproved) }

        Result.new(fiscal_year: fiscal_year, items: items, superseded: superseded, checksum: self.class.checksum(items))
      end

      # Signature of the balances, rates and data exclusions items were built from.
      def self.checksum(items)
        payload = items.map do |item|
          data_exclusion = DATA_EXCLUSIONS.include?(item[:excluded_reason].to_s) ? item[:excluded_reason] : ""
          [ item[:account_id], *(1..6).map { |l| item[:"center#{l}_id"] }, item[:currency_id],
            decimal(item[:currency_balance]), decimal(item[:book_base_balance]), decimal(item[:rate]),
            data_exclusion ].join(":")
        end.sort.join("|")
        Digest::SHA256.hexdigest(payload)
      end

      # Revaluations of a fiscal year can change while it is open, or while
      # it is being closed and not yet past the revaluation step (later steps
      # are built on the year-end FX balances).
      def self.ensure_changeable!(fiscal_year)
        raise Error.new(:fiscal_year_closed, fiscal_year: fiscal_year.name) if fiscal_year.closed?
        return unless fiscal_year.closing? && !(fiscal_year.step_renumber? || fiscal_year.step_revaluation?)

        raise Error.new(:fiscal_year_closing, fiscal_year: fiscal_year.name)
      end

      def self.decimal(value)
        value.nil? ? "" : BigDecimal(value.to_s).to_s("F")
      end

      # Why an item can't be posted with this gain/loss account, or nil.
      def self.posting_problem(item, gain_loss_account)
        return "missing_fx_account" if gain_loss_account.nil?

        (1..6).each do |level|
          next if gain_loss_account.public_send("allowed_center_types_#{level}").blank?
          return "center_mismatch" if item[:"center#{level}_id"].nil?
        end
        nil
      end

      # Keys (account, centers, currency) of combinations with draft or
      # booked items dated on or before the date, among these accounts.
      def self.unapproved_keys(organization_id:, fiscal_year_id:, as_of_date:, account_ids:)
        Accounting::JournalEntryItem
          .joins(:journal_entry)
          .where(journal_entries: { organization_id: organization_id, fiscal_year_id: fiscal_year_id,
                                    state: Accounting::JournalEntry.states.values_at("draft", "booked") })
          .where("journal_entries.date <= ?", as_of_date)
          .where(account_id: account_ids)
          .distinct
          .pluck(:account_id, *(1..6).map { |l| :"center#{l}_id" }, :currency_id)
          .to_set
      end

      private

      attr_reader :organization, :as_of_date, :scope, :kind, :revaluation

      def unapproved_keys(fiscal_year, rows)
        return Set.new if rows.empty?

        self.class.unapproved_keys(organization_id: organization.id, fiscal_year_id: fiscal_year.id,
                                   as_of_date: as_of_date, account_ids: rows.map(&:account_id).uniq)
      end

      def permanent_locks
        @permanent_locks ||= PermanentLocks.new(organization)
      end

      def locked_by_permanent?(row)
        permanent_locks.blocking(account_id: row.account_id, currency_id: row.currency_id,
                                 center_ids: row.center_ids, date: as_of_date, exclude_id: revaluation&.id).present?
      end

      def excluded(item, reason)
        item.merge(rate: nil, rate_date: nil, revalued_base_balance: nil, difference: 0,
                   gain_loss_account_id: nil, excluded: true, excluded_reason: reason)
      end

      def find_fiscal_year!
        fiscal_year = organization.fiscal_years.containing(as_of_date).first
        raise Error.new(:no_fiscal_year, date: as_of_date) unless fiscal_year
        self.class.ensure_changeable!(fiscal_year)
        fiscal_year
      end

      def posted_temporaries(fiscal_year)
        organization_revaluations
          .where(fiscal_year: fiscal_year, status: :posted, kind: :temporary)
          .where.not(id: revaluation&.id)
          .includes(:items)
          .to_a
      end

      def organization_revaluations
        Accounting::CurrencyRevaluation.where(organization_id: organization.id)
      end

      def overlaps?(temporary)
        temporary.items.any? { |item| in_scope?(item.account_id, item.currency_id, item.center_ids) }
      end

      def in_scope?(account_id, currency_id, center_ids)
        scope.match?(account_id: account_id, ledger_id: ledger_ids[account_id],
                     currency_id: currency_id, center_ids: center_ids)
      end

      # account id => ledger id, loaded on demand.
      def ledger_ids
        @ledger_ids ||= Hash.new do |hash, account_id|
          hash[account_id] = Accounting::Account.where(id: account_id).pick(:ledger_id)
        end
      end

      def balance_rows(fiscal_year, temporaries, carried_keys)
        base = { organization: organization, fiscal_year: fiscal_year, as_of: as_of_date,
                 monetary_only: true, foreign_only: true, exclude_sources: temporaries }

        rows = Accounting::Balances::Query.new(**base, **scope.query_filters).call
        if carried_keys.any?
          seen = rows.map(&:key).to_set
          carried_accounts = carried_keys.map(&:first).uniq
          extra = Accounting::Balances::Query.new(**base, account_ids: carried_accounts).call
          rows += extra.select { |row| carried_keys.include?(row.key) && !seen.include?(row.key) }
        end
        preload_ledgers(rows)
        rows.sort_by(&:key)
      end

      def preload_ledgers(rows)
        missing = rows.map(&:account_id).uniq - ledger_ids.keys
        Accounting::Account.where(id: missing).pluck(:id, :ledger_id).each { |id, ledger| ledger_ids[id] = ledger }
        fx_accounts.preload(rows.map(&:account_id).uniq)
        permanent_locks.preload_accounts(rows.map(&:account_id))
      end

      def build_item(row, unapproved)
        item = {
          account_id: row.account_id,
          currency_id: row.currency_id,
          currency_balance: row.currency_balance,
          book_base_balance: row.base_balance,
          removed: removed_keys.include?(row.key),
          **(1..6).to_h { |level| [ :"center#{level}_id", row.center_id(level) ] }
        }

        return excluded(item, "locked_by_permanent") if locked_by_permanent?(row)
        return excluded(item, "blocked_by_unapproved") if unapproved.include?(row.key)

        rate = rates.resolve(row.currency_id)
        return excluded(item, "missing_rate") unless rate

        revalued = (row.currency_balance * rate.rate).round(digits)
        difference = (revalued - row.base_balance).round(digits)
        gain_loss_account_id = difference.zero? ? nil : fx_accounts.resolve(row.account_id).for_difference(difference)
        problem = difference.zero? ? nil : self.class.posting_problem(item, gain_loss_accounts[gain_loss_account_id])

        item.merge(rate: rate.rate, rate_date: rate.rate_date, revalued_base_balance: revalued,
                   difference: difference, gain_loss_account_id: gain_loss_account_id,
                   excluded: problem.present?, excluded_reason: problem)
      end

      # Combinations the user left out of this revaluation.
      def removed_keys
        @removed_keys ||= revaluation ? revaluation.removed_key_set : Set.new
      end

      def rates
        @rates ||= Accounting::ExchangeRates::Resolver.new(organization: organization, date: as_of_date)
      end

      def fx_accounts
        @fx_accounts ||= FxAccountResolver.new(organization: organization)
      end

      def gain_loss_accounts
        @gain_loss_accounts ||= Hash.new { |hash, id| hash[id] = id && Accounting::Account.find_by(id: id) }
      end

      def digits
        @digits ||= organization.accounting_setting&.main_currency&.decimal_digits || 2
      end
    end
  end
end
