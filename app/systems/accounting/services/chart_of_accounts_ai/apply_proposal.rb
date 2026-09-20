# frozen_string_literal: true

module Accounting
  module ChartOfAccountsAi
    # Persists the latest validated proposal held in a chat's state into
    # the organization's chart of accounts.
    #
    # This service is transactional and idempotent-once-only: it refuses
    # to run again on an already-accepted chat. Re-validates the proposal
    # against the current accounting_setting before persisting — the
    # settings may have changed since the proposal was first validated.
    #
    # Concurrency: two near-simultaneous accept requests (double-click,
    # two tabs) both racing past a plain `chat.status == "accepted"`
    # check is a real scenario, not a hypothetical — the second one used
    # to hit a raw ActiveRecord::RecordNotUnique on the ledgers table and
    # 500. `persist!` now takes a pessimistic row lock on the chat
    # (`chat.lock!`) as the FIRST thing inside the transaction and
    # re-checks status under that lock. The second request blocks until
    # the first transaction commits, then sees status == "accepted" and
    # raises AlreadyAcceptedError cleanly instead of racing the unique
    # index. The RecordNotUnique rescue in #call is kept as a second line
    # of defense in case a future caller bypasses persist! or the lock
    # path changes.
    #
    # The heavy lifting is done in a single transaction. On any failure
    # (re-validation or an ActiveRecord save), the transaction rolls back
    # and the chat is left in "open" state so the user can revise and
    # retry.
    #
    # See ApplyProposalResult for the return shape.
    class ApplyProposal
      class AlreadyAcceptedError < StandardError; end

      def self.call(chat:)
        new(chat: chat).call
      end

      def initialize(chat:)
        @chat         = chat
        @organization = chat.organization
      end

      def call
        return already_accepted_result if chat.status == "accepted"
        return no_proposal_result       if raw_proposal.nil?

        proposal = Accounting::ChartOfAccountsProposal.from(raw_proposal)
        validation = Accounting::ChartOfAccountsProposalValidator.call(
          proposal:     proposal,
          organization: organization
        )

        unless validation.valid?
          return failure_result(serialize_errors(validation.errors))
        end

        persist!(proposal)

        success_result
      rescue AlreadyAcceptedError
        already_accepted_result
      rescue ActiveRecord::RecordInvalid => e
        failure_result([ serialize_record_error(e) ])
      rescue ActiveRecord::RecordNotUnique
        # Defense-in-depth: should be unreachable given the lock in
        # persist!, but if it ever does race past the lock, fail the
        # same way rather than letting a 500 escape.
        chat.reload
        already_accepted_result
      end

      private

      attr_reader :chat, :organization

      def raw_proposal
        chat.state["latest_proposal"]
      end

      # ── Persistence ─────────────────────────────────────────────────────

      def persist!(proposal)
        ActiveRecord::Base.transaction do
          # Row lock FIRST. This blocks a concurrent accept on the same
          # chat until this transaction commits or rolls back, and
          # refreshes chat's in-memory attributes from the locked row —
          # so the status check immediately below sees the true current
          # state, not a value read before the lock was acquired.
          chat.lock!
          raise AlreadyAcceptedError if chat.status == "accepted"

          upsert_system_categories(proposal)
          custom_category_records = create_custom_categories(proposal)
          ledger_records          = create_ledgers(proposal, custom_category_records)
          create_accounts(proposal, ledger_records)

          chat.accept!
          chat.update!(
            state: chat.state.merge(
              "accepted_at" => Time.current.iso8601
            )
          )
        end
      end

      # Updates name fields on the nine system categories that already
      # exist for this org, when the proposal declared them. Leaves
      # existing names alone if the proposal didn't provide one.
      def upsert_system_categories(proposal)
        proposal.categories
          .select { |c| c[:system] }
          .each do |entry|
            next if entry[:name].blank?

            existing = organization.account_categories.find_by(identifier: entry[:identifier])
            next unless existing

            entry[:name].each do |locale, value|
              Mobility.with_locale(locale) { existing.name = value }
            end
            existing.save!
          end
      end

      # Creates custom categories declared in the proposal and returns a
      # lookup of category_ref (the code the proposal used) → record.
      def create_custom_categories(proposal)
        proposal.categories
          .reject { |c| c[:system] }
          .each_with_object({}) do |entry, memo|
            record = organization.account_categories.create!(
              code:       entry[:code],
              identifier: nil,
              type:       "other"
            )
            assign_translated_name!(record, entry[:name])
            record.save!
            memo[entry[:code]] = record
          end
      end

      # Creates every ledger in the proposal. Returns a lookup of
      # ledger_ref ("<category_ref>.<ledger_code>") → record.
      def create_ledgers(proposal, custom_category_records)
        proposal.ledgers.each_with_object({}) do |entry, memo|
          category = resolve_category(entry, custom_category_records)

          record = category.ledgers.build(
            code:               entry[:code],
            unexpected_balance: entry[:unexpected_balance],
            is_monetary:        entry[:is_monetary]
          )
          assign_translated_name!(record, entry[:name])
          record.save!

          memo[ledger_ref(entry)] = record
        end
      end

      # Creates every account in the proposal.
      def create_accounts(proposal, ledger_records)
        proposal.accounts.each do |entry|
          ledger = ledger_records[entry[:ledger_ref]]
          raise ActiveRecord::RecordInvalid.new(Accounting::Account.new),
                "missing ledger for #{entry[:ledger_ref]}" if ledger.nil?

          record = ledger.accounts.build(
            code:                     entry[:code],
            accepts_other_currencies: entry[:accepts_other_currencies]
          )
          assign_translated_name!(record, entry[:name])
          record.save!
        end
      end

      # ── Resolution helpers ─────────────────────────────────────────────

      def resolve_category(entry, custom_category_records)
        if entry[:category_identifier].present?
          organization.account_categories.find_by!(identifier: entry[:category_identifier])
        else
          custom_category_records.fetch(entry[:category_ref])
        end
      end

      def ledger_ref(entry)
        "#{entry[:category_ref]}.#{entry[:code]}"
      end

      # ── Result builders ─────────────────────────────────────────────────

      def success_result
        ApplyProposalResult.new(
          success: true,
          chat:    chat.reload,
          chart:   build_chart_payload
        )
      end

      def failure_result(errors)
        ApplyProposalResult.new(
          success: false,
          chat:    chat,
          errors:  errors
        )
      end

      def already_accepted_result
        ApplyProposalResult.new(
          success: false,
          chat:    chat,
          errors:  [ { path: "chat", field: "status", message: "chat is already accepted" } ]
        )
      end

      def no_proposal_result
        ApplyProposalResult.new(
          success: false,
          chat:    chat,
          errors:  [ { path: "chat", field: "state.latest_proposal", message: "no proposal to accept" } ]
        )
      end

      # ── Post-persist tree payload ──────────────────────────────────────

      # Mirrors the shape GET /organizations/:id/accounting/chart_of_accounts
      # returns so the frontend can drop this into the tree with no refetch.
      def build_chart_payload
        categories = organization.account_categories
                       .includes(ledgers: :accounts)
                       .order(:id)

        categories.map do |cat|
          {
            id:         cat.id,
            code:       cat.code,
            identifier: cat.identifier,
            type:       cat.type,
            name:       cat.name,
            ledgers:    cat.ledgers.map do |ledger|
              {
                id:                  ledger.id,
                code:                ledger.code,
                full_code:           ledger.full_code,
                name:                ledger.name,
                unexpected_balance:  ledger.unexpected_balance,
                is_monetary:         ledger.is_monetary,
                accounts:            ledger.accounts.map do |account|
                  {
                    id:                       account.id,
                    code:                     account.code,
                    full_code:                account.full_code,
                    name:                     account.name,
                    accepts_other_currencies: account.accepts_other_currencies
                  }
                end
              }
            end
          }
        end
      end

      # ── Error serialization ────────────────────────────────────────────

      def serialize_errors(errors)
        errors.map do |err|
          {
            path:    err.respond_to?(:path) ? err.path : nil,
            field:   err.respond_to?(:field) ? err.field : nil,
            message: err.respond_to?(:message) ? err.message : err.to_s
          }
        end
      end

      def serialize_record_error(error)
        record = error.record
        {
          path:    record.class.name,
          field:   "save",
          message: record.errors.full_messages.join(", ")
        }
      end

      # ── Translation helper ──────────────────────────────────────────────

      # Assigns a `{ locale => value }` hash to a Mobility-backed `name`
      # attribute correctly. Mobility's `name=` setter assigns the value for
      # whatever the CURRENT locale is — it does not accept a full
      # translations hash in one call. Passing the hash directly (as the
      # proposal's raw `entry[:name]` is shaped) causes Mobility to store the
      # entire hash AS THE VALUE for the current locale, double-nesting it
      # (e.g. `{"en" => {"en" => "Baking Equipment"}}`). Iterating per-locale
      # with Mobility.with_locale is the correct pattern — see
      # upsert_system_categories above, which already did this right.
      def assign_translated_name!(record, name_by_locale)
        name_by_locale.each do |locale, value|
          Mobility.with_locale(locale) { record.name = value }
        end
      end
    end
  end
end