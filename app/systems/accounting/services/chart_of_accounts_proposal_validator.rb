# frozen_string_literal: true

module Accounting
  # Validates an Accounting::ChartOfAccountsProposal against an
  # Organization's accounting_setting and the model-layer rules the
  # persistence step will enforce.
  #
  # The validator is PURE with respect to the database — it reads
  # `organization.accounting_setting` but never writes anything. It is the
  # single source of truth for "would this proposal be acceptable as a
  # chart of accounts for this organization?".
  #
  # Usage:
  #
  #   proposal  = Accounting::ChartOfAccountsProposal.from(raw_hash)
  #   result    = Accounting::ChartOfAccountsProposalValidator.call(
  #                 proposal: proposal,
  #                 organization: org
  #               )
  #   result.valid?       # => true / false
  #   result.errors       # => [{ path:, field:, message: }, ...]
  #
  # Errors are shaped so the caller (the AI chat loop) can feed them
  # straight back into the next LLM turn as structured feedback.
  class ChartOfAccountsProposalValidator
    # Categories on which `is_monetary: true` is meaningful. Locked to the
    # balance-sheet set per product decision: RE and EX are income-statement
    # categories and cannot be monetary.
    MONETARY_CATEGORY_IDENTIFIERS = %w[CA LA CL LL OE].freeze

    Error = Struct.new(:path, :field, :message, keyword_init: true)

    Result = Struct.new(:errors, keyword_init: true) do
      def valid?
        errors.empty?
      end
    end

    def self.call(proposal:, organization:)
      new(proposal: proposal, organization: organization).call
    end

    def initialize(proposal:, organization:)
      @proposal     = proposal
      @organization = organization
      @settings     = organization.accounting_setting
      @errors       = []
    end

    def call
      # Structural errors from the proposal object are surfaced first —
      # they indicate the AI emitted something malformed, and every other
      # check assumes a well-formed shape.
      proposal.structural_errors.each do |err|
        errors << Error.new(path: err.path, field: err.field, message: err.message)
      end

      unless settings
        errors << Error.new(
          path: "accounting_setting",
          field: "base",
          message: "organization has no accounting_setting configured"
        )
        return Result.new(errors: errors)
      end

      validate_category_code_lengths
      validate_ledger_code_lengths
      validate_account_code_lengths
      validate_monetary_categories
      validate_ledgers_have_accounts
      validate_at_least_one_ledger

      Result.new(errors: errors)
    end

    private

    attr_reader :proposal, :organization, :settings, :errors

    # ── Length checks ───────────────────────────────────────────────────

    def validate_category_code_lengths
      expected = settings.account_category_length
      return if expected.blank?

      proposal.categories.each do |category|
        # System categories have a fixed code from the model; a length
        # mismatch there is a data bug we shouldn't blame the AI for. Only
        # custom categories are checked — they're the ones the AI invented.
        next if category[:system]

        if category[:code].to_s.length != expected
          errors << Error.new(
            path: "categories[#{category[:code]}]",
            field: "code",
            message: "category code must be exactly #{expected} characters, " \
                     "got #{category[:code].to_s.length}"
          )
        end
      end
    end

    def validate_ledger_code_lengths
      expected = settings.ledger_length
      return if expected.blank?

      proposal.ledgers.each do |ledger|
        if ledger[:code].to_s.length != expected
          errors << Error.new(
            path: ledger[:full_code],
            field: "code",
            message: "ledger code must be exactly #{expected} characters, " \
                     "got #{ledger[:code].to_s.length}"
          )
        end
      end
    end

    def validate_account_code_lengths
      expected = settings.account_length
      return if expected.blank?

      proposal.accounts.each do |account|
        if account[:code].to_s.length != expected
          errors << Error.new(
            path: account[:full_code],
            field: "code",
            message: "account code must be exactly #{expected} characters, " \
                     "got #{account[:code].to_s.length}"
          )
        end
      end
    end

    # ── Domain rule: is_monetary only on balance-sheet categories ──────

    def validate_monetary_categories
      proposal.ledgers.each do |ledger|
        next unless ledger[:is_monetary]

        identifier = ledger[:category_identifier]

        # Custom categories (identifier nil) can never be monetary.
        if identifier.nil?
          errors << Error.new(
            path: ledger[:full_code],
            field: "is_monetary",
            message: "custom categories cannot be monetary"
          )
          next
        end

        unless MONETARY_CATEGORY_IDENTIFIERS.include?(identifier)
          errors << Error.new(
            path: ledger[:full_code],
            field: "is_monetary",
            message: "is_monetary is only allowed on #{MONETARY_CATEGORY_IDENTIFIERS.join(', ')} " \
                     "categories (got #{identifier})"
          )
        end
      end
    end

    # ── Completeness nudges ─────────────────────────────────────────────

    def validate_ledgers_have_accounts
      accounts_by_ledger = proposal.accounts.group_by { |a| a[:ledger_ref] }

      proposal.ledgers.each do |ledger|
        ref = "#{ledger[:category_ref]}.#{ledger[:code]}"
        next if accounts_by_ledger[ref]&.any?

        errors << Error.new(
          path: ledger[:full_code],
          field: "accounts",
          message: "ledger has no accounts; every ledger should have at least one"
        )
      end
    end

    def validate_at_least_one_ledger
      return if proposal.ledgers.any?

      errors << Error.new(
        path: "ledgers",
        field: "base",
        message: "proposal contains no ledgers"
      )
    end
  end
end
