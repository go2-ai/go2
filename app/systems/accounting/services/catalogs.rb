# frozen_string_literal: true

require "yaml"

module Accounting
  # Loads YAML starter-chart definitions from
  # app/systems/accounting/catalogs/. See the README in that directory for
  # the file format and the design rationale.
  #
  # This module is a pure loader — it does not touch the database and does
  # not validate against an organization's accounting_setting. Business
  # validation happens later in ChartOfAccountsProposalValidator.
  module Catalogs
    class Error < StandardError; end
    class NotFoundError < Error; end
    class InvalidCatalogError < Error; end

    SYSTEM_CATEGORY_IDENTIFIERS = %w[CA LA CL LL OE RE EX CO ME].freeze

    class << self
      # Returns the sorted list of catalog keys found on disk.
      #
      #   Accounting::Catalogs.available
      #   # => ["service_company"]
      def available
        Dir.glob(catalogs_dir.join("*.yml"))
           .map { |path| File.basename(path, ".yml") }
           .sort
      end

      # Loads a catalog by key and returns it as a deeply-symbolized Hash.
      #
      #   Accounting::Catalogs.load("service_company")
      #   # => { key: "service_company", label: { en:, fa: }, ... }
      #
      # Raises NotFoundError if the key has no matching file, or
      # InvalidCatalogError if the file is structurally malformed.
      def load(key)
        key = key.to_s
        path = catalogs_dir.join("#{key}.yml")

        raise NotFoundError, "Catalog '#{key}' not found in #{catalogs_dir}" unless File.exist?(path)

        raw = YAML.safe_load(File.read(path), permitted_classes: [], aliases: false)
        validate!(key, raw)
        deep_symbolize(raw)
      end

      private

      def catalogs_dir
        Rails.root.join("app", "systems", "accounting", "catalogs")
      end

      def validate!(key, raw)
        unless raw.is_a?(Hash)
          raise InvalidCatalogError, "#{key}: catalog must be a Hash at the top level"
        end

        file_key = raw["key"]
        unless file_key == key
          raise InvalidCatalogError,
                "#{key}: `key` field is #{file_key.inspect} but filename is '#{key}'"
        end

        validate_name!(key, raw, "catalog")

        validate_categories!(key, raw.fetch("categories", []))
        validate_ledgers!(key, raw.fetch("ledgers", []))
        validate_accounts!(key, raw.fetch("ledgers", []), raw.fetch("accounts", []))
      end

      # ── Individual section validators ───────────────────────────────────

      def validate_name!(key, raw, subject)
        name = raw["name"]
        return if subject != "catalog" # only top-level label/description required

        %w[label description].each do |field|
          value = raw[field]
          unless value.is_a?(Hash) && value.key?("en")
            raise InvalidCatalogError,
                  "#{key}: `#{field}` must be a Hash containing at least an `en` key"
          end
        end
      end

      def validate_categories!(key, categories)
        unless categories.is_a?(Array)
          raise InvalidCatalogError, "#{key}: `categories` must be an Array"
        end

        return if categories.empty?

        # v1 restriction: catalogs reference only the nine system categories.
        # Custom categories are added later by the AI diff layer (add_category),
        # not declared inside a YAML file.
        raise InvalidCatalogError,
              "#{key}: custom `categories` are not supported in v1 — must be empty"
      end

      def validate_ledgers!(key, ledgers)
        unless ledgers.is_a?(Array) && ledgers.any?
          raise InvalidCatalogError, "#{key}: `ledgers` must be a non-empty Array"
        end

        seen = {}

        ledgers.each_with_index do |ledger, idx|
          unless ledger.is_a?(Hash)
            raise InvalidCatalogError, "#{key}: ledger ##{idx} must be a Hash"
          end

          category = ledger["category"]
          unless SYSTEM_CATEGORY_IDENTIFIERS.include?(category)
            raise InvalidCatalogError,
                  "#{key}: ledger ##{idx} references unknown category #{category.inspect} " \
                  "(must be one of #{SYSTEM_CATEGORY_IDENTIFIERS.join(', ')})"
          end

          code = ledger["code"]
          if code.nil? || code.to_s.strip.empty?
            raise InvalidCatalogError, "#{key}: ledger ##{idx} is missing `code`"
          end

          validate_entry_name!(key, "ledger ##{idx}", ledger["name"])

          pair = [ category, code.to_s ]
          if seen[pair]
            raise InvalidCatalogError,
                  "#{key}: duplicate ledger #{category}.#{code}"
          end
          seen[pair] = true
        end
      end

      def validate_accounts!(key, ledgers, accounts)
        unless accounts.is_a?(Array) && accounts.any?
          raise InvalidCatalogError, "#{key}: `accounts` must be a non-empty Array"
        end

        known_ledgers = {}
        ledgers.each do |ledger|
          known_ledgers[[ ledger["category"], ledger["code"].to_s ]] = true
        end

        seen = {}

        accounts.each_with_index do |account, idx|
          unless account.is_a?(Hash)
            raise InvalidCatalogError, "#{key}: account ##{idx} must be a Hash"
          end

          ledger_ref = account["ledger"]
          unless ledger_ref.is_a?(String) && ledger_ref.include?(".")
            raise InvalidCatalogError,
                  "#{key}: account ##{idx} `ledger` must be a " \
                  "'<category>.<ledger_code>' string, got #{ledger_ref.inspect}"
          end

          category, ledger_code = ledger_ref.split(".", 2)
          unless known_ledgers[[ category, ledger_code ]]
            raise InvalidCatalogError,
                  "#{key}: account ##{idx} references ledger " \
                  "#{ledger_ref.inspect} which is not defined in this catalog"
          end

          code = account["code"]
          if code.nil? || code.to_s.strip.empty?
            raise InvalidCatalogError, "#{key}: account ##{idx} is missing `code`"
          end

          validate_entry_name!(key, "account ##{idx}", account["name"])

          pair = [ ledger_ref, code.to_s ]
          if seen[pair]
            raise InvalidCatalogError,
                  "#{key}: duplicate account #{ledger_ref}.#{code}"
          end
          seen[pair] = true
        end
      end

      def validate_entry_name!(key, label, name)
        unless name.is_a?(Hash) && name.any?
          raise InvalidCatalogError,
                "#{key}: #{label} must have a non-empty `name` Hash"
        end
      end

      # ── Utilities ───────────────────────────────────────────────────────

      def deep_symbolize(value)
        case value
        when Hash
          value.each_with_object({}) do |(k, v), memo|
            memo[k.to_sym] = deep_symbolize(v)
          end
        when Array
          value.map { |v| deep_symbolize(v) }
        else
          value
        end
      end
    end
  end
end
