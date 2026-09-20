# frozen_string_literal: true

module Accounting
  module ChartOfAccountsAi
    # Builds the "here is the context" block that goes into the system
    # prompt. Reads only what's needed:
    #
    #   - the nine system categories and their codes (from constants)
    #   - the org's accounting settings (code lengths, center_levels)
    #   - the org's active locales (so the AI knows which languages to
    #     fill into `name`)
    #   - the available starter catalogs (key + label + description)
    #
    # It does NOT read the org's existing chart because, per the
    # availability gate, the chart is empty by construction whenever
    # this feature is usable.
    #
    # Output is a plain String (markdown-ish) — no structured payload.
    # The AI reads prose more reliably than nested JSON here, and the
    # tool schema is where the structural contract lives.
    class ContextBuilder
      def self.call(organization:)
        new(organization: organization).call
      end

      def initialize(organization:)
        @organization = organization
      end

      def call
        parts = []
        parts << organization_block
        parts << system_categories_block
        parts << accounting_settings_block
        parts << available_catalogs_block
        parts << locales_block
        parts.join("\n\n")
      end

      private

      attr_reader :organization

      def organization_block
        <<~TEXT.strip
          ## Organization
          - Name: #{organization_name}
          - Primary locale: #{organization.locale}
          - Active locales: #{active_locales.join(', ')}
        TEXT
      end

      def organization_name
        organization.name.presence || "Unnamed"
      end

      def active_locales
        (organization.active_locales.presence || [ organization.locale ]).map(&:to_s)
      end

      def system_categories_block
        lines = Accounting::ChartOfAccountsProposal::SYSTEM_CATEGORY_CODES.map do |identifier, code|
          "  - #{identifier} (code: #{code})"
        end

        <<~TEXT.strip
          ## System Categories (always created for every organization)
          #{lines.join("\n")}

          You do NOT need to declare these in `categories` — they already exist.
          Only declare a category in `categories` if you need a custom "other"
          category that doesn't fit any of the above.
        TEXT
      end

      def accounting_settings_block
        s = organization.accounting_setting

        unless s
          return <<~TEXT.strip
            ## Accounting Settings
            WARNING: This organization has no accounting_setting. You cannot
            produce a valid proposal until that is configured.
          TEXT
        end

        <<~TEXT.strip
          ## Accounting Settings
          - account_category_length: #{s.account_category_length}
          - ledger_length: #{s.ledger_length}
          - account_length: #{s.account_length}

          Every code suffix you produce MUST match the corresponding length
          exactly. Codes that are too short or too long will be rejected.
        TEXT
      end

      def available_catalogs_block
        catalogs = Accounting::Catalogs.available

        if catalogs.empty?
          return <<~TEXT.strip
            ## Starter Catalogs
            (No starter catalogs are available on this server.)
          TEXT
        end

        entries = catalogs.map do |key|
          cat = Accounting::Catalogs.load(key)
          label = cat.dig(:label, :en) || key
          description = cat.dig(:description, :en) || ""
          "  - #{key}: #{label} — #{description}"
        end

        <<~TEXT.strip
          ## Starter Catalogs (use these as a starting point)
          #{entries.join("\n")}

          You may base your proposal on one of these catalogs and adapt it
          to the user's described needs. You may also build a proposal from
          scratch — the schema does not require you to pick a catalog.
        TEXT
      end

      def locales_block
        <<~TEXT.strip
          ## Translations
          Every ledger/account `name` and category `name` must be an object
          of locale code → string. You must always include the primary locale
          ("#{organization.locale}"). Include translations for the other
          active locales when you can produce good ones — the user's UI is
          multilingual.
        TEXT
      end
    end
  end
end
