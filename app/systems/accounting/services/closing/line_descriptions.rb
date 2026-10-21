# app/systems/accounting/services/closing/line_descriptions.rb
module Accounting
  module Closing
    # Descriptions of the lines of the closing entries, from templates such as
    #
    #   "Ending balance of {account_code} {account_name}, {fiscal_year}"
    #
    # Kinds of line:
    #   closing         income statement (and income summary) balances closed
    #   closing_offset  the closing account receiving them (retained earnings,
    #                   income summary or current year profit)
    #   ending          balances closed by the ending entry
    #   beginning       balances opened by the beginning entry
    #
    # Templates are per locale. For each locale the closing's own template is
    # used (fiscal_year.closing_data["line_templates"]), else the organization
    # default (accounting settings), else the built-in one.
    class LineDescriptions
      KINDS = %w[closing closing_offset ending beginning].freeze
      VARIABLES = (%w[fiscal_year next_fiscal_year date account_code account_name currency currency_amount] +
                   Revaluation::LineDescriptions::CENTER_VARIABLES).freeze
      TOKEN = Revaluation::LineDescriptions::TOKEN

      def self.problem_messages(templates)
        Revaluation::LineDescriptions.problem_messages(templates, VARIABLES)
      end

      # Validates { kind => { locale => template } } into record.errors.
      def self.validate(record, attribute, templates)
        unless templates.is_a?(Hash)
          record.errors.add(attribute, Accounting::CurrencyRevaluation.model_t("errors.template_invalid"))
          return
        end
        templates.each do |kind, by_locale|
          next record.errors.add(attribute, Accounting::CurrencyRevaluation.model_t("errors.template_invalid")) unless KINDS.include?(kind.to_s)

          problem_messages(by_locale).each { |message| record.errors.add(attribute, message) }
        end
      end

      def self.built_in(kind, locale)
        Accounting::FiscalYearClosing.model_t("line_templates.#{kind}", locale: locale)
      end

      # { kind => { locale => template } } used where the closing has none.
      def self.defaults(organization)
        own = organization.accounting_setting&.closing_line_description_templates.to_h
        KINDS.to_h do |kind|
          [ kind, organization.entry_locales.to_h { |locale| [ locale, own.dig(kind, locale).presence || built_in(kind, locale) ] } ]
        end
      end

      def initialize(fiscal_year)
        @fiscal_year = fiscal_year
      end

      # { locale => text } for a line (hash with account_id, currency_id,
      # currency_amount, center1_id..center6_id) of an entry dated `date`.
      def describe(kind, line, date:)
        values = {
          "date" => date&.iso8601.to_s,
          "currency" => currency(line[:currency_id])&.abr.to_s,
          "currency_amount" => foreign_amount(line)
        }
        account = accounts[line[:account_id]]
        organization.entry_locales.to_h do |locale|
          all = values.merge(
            "fiscal_year" => translated(fiscal_year, locale), "next_fiscal_year" => translated(next_fiscal_year, locale),
            "account_code" => account&.full_code.to_s, "account_name" => translated(account, locale)
          )
          (1..6).each do |level|
            center = centers[line[:"center#{level}_id"]]
            all["center#{level}_code"] = center&.code.to_s
            all["center#{level}_name"] = translated(center, locale)
          end
          [ locale, template(kind, locale).gsub(TOKEN) { all.fetch(Regexp.last_match(1).strip, "") }.squish ]
        end
      end

      # Loads the accounts, centers and currencies of these lines at once.
      def preload(lines)
        load(accounts, Accounting::Account, lines.map { |l| l[:account_id] })
        load(centers, Accounting::Center, lines.flat_map { |l| (1..6).map { |level| l[:"center#{level}_id"] } })
        load(currencies, Accounting::Currency, lines.map { |l| l[:currency_id] })
        self
      end

      private

      attr_reader :fiscal_year

      def template(kind, locale)
        fiscal_year.closing_data.dig("line_templates", kind, locale).presence ||
          (@defaults ||= self.class.defaults(organization)).dig(kind, locale)
      end

      def foreign_amount(line)
        amount = line[:currency_amount]
        return "" if amount.nil? || amount.to_d.zero? || line[:currency_id] == main_currency_id

        ActiveSupport::NumberHelper.number_to_rounded(amount.to_d, precision: currency(line[:currency_id])&.decimal_digits || 2,
                                                                  delimiter: ",")
      end

      def translated(record, locale)
        record ? Mobility.with_locale(locale) { record.name.to_s } : ""
      end

      def load(cache, model, ids)
        missing = ids.compact.uniq - cache.keys
        model.where(id: missing).each { |record| cache[record.id] = record } if missing.any?
      end

      def accounts
        @accounts ||= Hash.new { |hash, id| hash[id] = id && Accounting::Account.find_by(id: id) }
      end

      def centers
        @centers ||= Hash.new { |hash, id| hash[id] = id && Accounting::Center.find_by(id: id) }
      end

      def currencies
        @currencies ||= Hash.new { |hash, id| hash[id] = id && Accounting::Currency.find_by(id: id) }
      end

      def currency(id)
        currencies[id]
      end

      def next_fiscal_year
        return @next_fiscal_year if defined?(@next_fiscal_year)

        @next_fiscal_year = fiscal_year.closing_next_fiscal_year
      end

      def main_currency_id
        @main_currency_id ||= organization.accounting_setting&.main_currency_id
      end

      def organization
        fiscal_year.organization
      end
    end
  end
end
