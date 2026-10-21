# app/systems/accounting/models/currency_revaluation_item.rb
module Accounting
  # One account × center1..6 × currency combination of a revaluation.
  #   currency_balance       signed balance in the item currency
  #   book_base_balance      signed balance in the main currency (book value)
  #   revalued_base_balance  currency_balance × rate, rounded
  #   difference             revalued − book: positive = gain on debit
  #                          balances / loss reduction on credit balances
  class CurrencyRevaluationItem < ApplicationRecord
    EXCLUDED_REASONS = %w[
      missing_rate missing_fx_account center_mismatch blocked_by_unapproved locked_by_permanent
    ].freeze

    belongs_to :currency_revaluation, class_name: "Accounting::CurrencyRevaluation", inverse_of: :items
    belongs_to :account, class_name: "Accounting::Account"
    belongs_to :currency, class_name: "Accounting::Currency"
    belongs_to :gain_loss_account, class_name: "Accounting::Account", optional: true
    (1..6).each do |level|
      belongs_to :"center#{level}", class_name: "Accounting::Center", optional: true
    end

    validates :excluded_reason, inclusion: { in: EXCLUDED_REASONS }, allow_nil: true

    def center_ids
      (1..6).map { |level| public_send("center#{level}_id") }
    end

    # Posted with the revaluation: not excluded, not left out by the user,
    # and with a difference.
    def postable?
      !excluded? && !removed? && !difference.zero?
    end

    # Same identity as Accounting::Balances::Query::Row#key.
    def key
      [ account_id, *center_ids, currency_id ]
    end
  end
end
