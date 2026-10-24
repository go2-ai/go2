module Accounting
  # What the report runners need to know about accounts, in one query:
  # id => { ledger_id:, category_id:, identifier:, category_type:, code: }
  # (code is the account's full code). Kept in a cache hash that grows as
  # rows of new accounts arrive.
  class AccountReferences
    def initialize
      @cache = {}
    end

    def fetch(id)
      @cache.fetch(id)
    end

    def [](id)
      @cache[id]
    end

    def load(ids)
      missing = ids.uniq - @cache.keys
      return self if missing.empty?

      types = Accounting::AccountCategory.types.invert
      Accounting::Account.joins(ledger: :account_category).where(id: missing)
                         .pluck(:id, :ledger_id, "account_categories.id", "account_categories.identifier",
                                "account_categories.type", "account_categories.code", "ledgers.code", "accounts.code")
                         .each do |id, ledger_id, category_id, identifier, type, category_code, ledger_code, code|
        @cache[id] = { ledger_id: ledger_id, category_id: category_id, identifier: identifier,
                       category_type: types.fetch(type, type).to_s, code: "#{category_code}#{ledger_code}#{code}" }
      end
      self
    end
  end
end
