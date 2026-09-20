# frozen_string_literal: true

module Accounting
  # A parsed, normalized, code-resolved chart of accounts.
  #
  # Input:  a raw Hash shaped like a catalog file (see
  #         app/systems/accounting/catalogs/README.md) — categories,
  #         ledgers, accounts.
  # Output: three arrays of normalized entry hashes with:
  #         - symbol-keyed attributes
  #         - resolved `full_code` on every ledger and account
  #         - a stable `system` boolean on every category
  #         - a stable `origin` tag distinguishing system-declared
  #           entries from entries the proposal introduced
  #
  # This class is PURE. No database, no organization, no accounting_setting.
  # Its only job is structural: turn loosely-shaped input into a canonical
  # in-memory tree, and report structural problems. Business validation
  # against an organization's accounting_setting lives in
  # Accounting::ChartOfAccountsProposalValidator.
  #
  # See also: Accounting::Catalogs (loader for the same shape).
  class ChartOfAccountsProposal
    # The nine category identifiers the app auto-creates for every org.
    # Custom categories (identifier: nil) are allowed in a proposal but must
    # carry `type: "other"`; see the validator for the enforcement point.
    SYSTEM_CATEGORY_IDENTIFIERS = %w[CA LA CL LL OE RE EX CO ME].freeze

    # Numeric codes for the system categories. These mirror
    # Accounting::AccountCategory.system_categories in the model layer.
    # Kept here as a local constant so the proposal layer stays pure (no
    # Rails boot dependency) — a spec asserts the two agree.
    SYSTEM_CATEGORY_CODES = {
      "CA" => "1",
      "LA" => "2",
      "CL" => "3",
      "LL" => "4",
      "OE" => "5",
      "RE" => "6",
      "EX" => "7",
      "CO" => "8",
      "ME" => "9"
    }.freeze

    UNEXPECTED_BALANCE_VALUES = %w[accept warn disallow].freeze

    # Valid category types in a proposal.
    # - System categories: implied by identifier.
    # - Custom categories: must be exactly :other.
    CUSTOM_CATEGORY_TYPE = "other"

    StructuralError = Struct.new(:path, :field, :message, keyword_init: true)

    attr_reader :categories, :ledgers, :accounts, :structural_errors

    # Parse a raw proposal Hash (string or symbol keys, from JSON or YAML).
    def self.from(raw)
      new(raw)
    end

    def initialize(raw)
      raw = deep_symbolize(raw) || {}

      @raw = raw
      @structural_errors = []

      build_categories(raw[:categories] || [])
      build_ledgers(raw[:ledgers] || [])
      build_accounts(raw[:accounts] || [])
    end

    def valid_structure?
      structural_errors.empty?
    end

    # Convenience: the numeric code for a system category identifier.
    # Custom categories carry their code inline and don't use this.
    def self.system_category_code(identifier)
      SYSTEM_CATEGORY_CODES[identifier]
    end

    private

    # ── Category construction ───────────────────────────────────────────

    def build_categories(raw_categories)
      @categories = []
      seen_codes = {}

      # System categories are always present, regardless of what the proposal
      # declares. This mirrors the fact that every organization gets them
      # auto-created; a proposal that omits one has still "declared" it,
      # implicitly, by relying on the system's defaults.
      SYSTEM_CATEGORY_IDENTIFIERS.each do |identifier|
        code = SYSTEM_CATEGORY_CODES.fetch(identifier)
        @categories << {
          identifier: identifier,
          code: code,
          name: nil,          # filled from proposal if provided, else nil
          system: true,
          type: nil           # type is derived from identifier for system cats
        }
        seen_codes[code] = identifier
      end

      raw_categories.each_with_index do |entry, idx|
        path = "categories[#{idx}]"

        unless entry.is_a?(Hash)
          add_error(path, "category", "must be a Hash")
          next
        end

        identifier = entry[:identifier]
        code       = entry[:code]&.to_s
        name       = normalize_name(entry[:name])
        type       = entry[:type]&.to_s

        if identifier.present?
          # Declaring a system category explicitly — must reference a known
          # identifier, and may enrich the auto-created entry with a name.
          unless SYSTEM_CATEGORY_IDENTIFIERS.include?(identifier)
            add_error(path, "identifier",
                      "unknown system category #{identifier.inspect} " \
                      "(must be one of #{SYSTEM_CATEGORY_IDENTIFIERS.join(', ')})")
            next
          end

          target = @categories.find { |c| c[:identifier] == identifier }
          target[:name] = name if name
          target[:type] = type if type
          next
        end

        # Custom category — the v1 restriction: type must be "other".
        unless type == CUSTOM_CATEGORY_TYPE
          add_error(path, "type",
                    "custom categories must have type: \"#{CUSTOM_CATEGORY_TYPE}\"")
          next
        end

        if code.nil? || code.strip.empty?
          add_error(path, "code", "custom categories must declare a code")
          next
        end

        if seen_codes.key?(code)
          add_error(path, "code",
                    "duplicate category code #{code.inspect} " \
                    "(also used by #{seen_codes[code]})")
          next
        end

        if name.nil? || name.empty?
          add_error(path, "name", "must not be blank")
          next
        end

        seen_codes[code] = "(custom)"
        @categories << {
          identifier: nil,
          code: code,
          name: name,
          system: false,
          type: CUSTOM_CATEGORY_TYPE
        }
      end
    end

    # ── Ledger construction ─────────────────────────────────────────────

    def build_ledgers(raw_ledgers)
      @ledgers = []
      seen = {}

      raw_ledgers.each_with_index do |entry, idx|
        path = "ledgers[#{idx}]"

        unless entry.is_a?(Hash)
          add_error(path, "ledger", "must be a Hash")
          next
        end

        category_id = entry[:category]&.to_s
        code        = entry[:code]&.to_s
        name        = normalize_name(entry[:name])
        unexpected  = entry[:unexpected_balance]&.to_s
        monetary    = entry[:is_monetary]

        category = @categories.find do |c|
          (category_id && c[:identifier] == category_id) ||
            (!c[:system] && c[:code] == category_id)
        end

        # Note: a ledger's `category` may be a system identifier ("CA") or
        # the code of a custom category declared in the same proposal (e.g.
        # "0"). Both resolve via the @categories list.

        unless category
          add_error(path, "category",
                    "unknown category #{category_id.inspect} " \
                    "(must be a system identifier or a code declared in `categories`)")
          next
        end

        if code.nil? || code.strip.empty?
          add_error(path, "code", "must not be blank")
          next
        end

        if name.nil? || name.empty?
          add_error(path, "name", "must not be blank")
          next
        end

        if unexpected && !UNEXPECTED_BALANCE_VALUES.include?(unexpected)
          add_error(path, "unexpected_balance",
                    "must be one of #{UNEXPECTED_BALANCE_VALUES.join(', ')}")
          next
        end

        pair = [ category[:code], code ]
        if seen[pair]
          add_error(path, "code",
                    "duplicate ledger #{category_id}.#{code}")
          next
        end
        seen[pair] = true

        full_code = "#{category[:code]}#{code}"

        @ledgers << {
          category_identifier: category[:identifier],
          category_code:       category[:code],
          category_ref:        category[:identifier] || category[:code],
          code:                code,
          full_code:           full_code,
          name:                name,
          unexpected_balance:  unexpected || "accept",
          is_monetary:         !!monetary,
          system:              category[:system],
          origin:              category[:system] ? "system" : "custom"
        }
      end
    end

    # ── Account construction ────────────────────────────────────────────

    def build_accounts(raw_accounts)
      @accounts = []
      seen = {}

      raw_accounts.each_with_index do |entry, idx|
        path = "accounts[#{idx}]"

        unless entry.is_a?(Hash)
          add_error(path, "account", "must be a Hash")
          next
        end

        ledger_ref = entry[:ledger]&.to_s
        code       = entry[:code]&.to_s
        name       = normalize_name(entry[:name])
        accepts    = entry[:accepts_other_currencies]

        unless ledger_ref.is_a?(String) && ledger_ref.include?(".")
          add_error(path, "ledger",
                    "must be a \"<category_ref>.<ledger_code>\" string " \
                    "(got #{ledger_ref.inspect})")
          next
        end

        category_ref, ledger_code = ledger_ref.split(".", 2)

        ledger = @ledgers.find do |l|
          l[:category_ref] == category_ref && l[:code] == ledger_code
        end

        unless ledger
          add_error(path, "ledger",
                    "references ledger #{ledger_ref.inspect} which is " \
                    "not defined in this proposal")
          next
        end

        if code.nil? || code.strip.empty?
          add_error(path, "code", "must not be blank")
          next
        end

        if name.nil? || name.empty?
          add_error(path, "name", "must not be blank")
          next
        end

        pair = [ ledger_ref, code ]
        if seen[pair]
          add_error(path, "code",
                    "duplicate account #{ledger_ref}.#{code}")
          next
        end
        seen[pair] = true

        @accounts << {
          ledger_ref:               ledger_ref,
          code:                     code,
          full_code:                "#{ledger[:full_code]}#{code}",
          name:                     name,
          accepts_other_currencies: !!accepts,
          origin:                   ledger[:origin]
        }
      end
    end

    # ── Helpers ─────────────────────────────────────────────────────────

    def normalize_name(raw)
      case raw
      when Hash
        raw.each_with_object({}) do |(locale, value), memo|
          next if value.nil? || value.to_s.strip.empty?
          memo[locale.to_sym] = value.to_s
        end
      when String
        { en: raw }
      else
        nil
      end
    end

    def add_error(path, field, message)
      @structural_errors << StructuralError.new(path: path, field: field, message: message)
    end

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
