# app/systems/accounting/services/revaluation/line_descriptions.rb
module Accounting
  module Revaluation
    # Descriptions of the lines of a revaluation entry, from templates such as
    #
    #   "Revaluation of {account_name} {currency_balance} {currency} at {rate}"
    #
    # Two kinds of line:
    #   item     one per revalued account × centers × currency balance
    #   counter  the net gain/loss per gain/loss account and centers
    #
    # Templates are per locale ({ "en" => "...", "fa" => "..." }). For each
    # locale the revaluation's template is used, else the organization
    # default (accounting settings), else the built-in one.
    class LineDescriptions
      KINDS = %w[item counter].freeze
      CENTER_VARIABLES = (1..6).flat_map { |level| [ "center#{level}_code", "center#{level}_name" ] }.freeze
      VARIABLES = {
        "item" => (%w[as_of_date account_code account_name currency currency_balance book_balance rate rate_date
                      revalued_balance difference] + CENTER_VARIABLES).freeze,
        "counter" => (%w[as_of_date account_code account_name difference] + CENTER_VARIABLES).freeze
      }.freeze
      MAX_LENGTH = 300
      TOKEN = /\{([^{}]*)\}/

      # Problems of a template as [error key, interpolation values] pairs;
      # empty when it is valid. Blank templates are valid (they fall back).
      def self.problems(template, kind)
        template_problems(template, VARIABLES.fetch(kind))
      end

      # The same rules for any line template (also the closing entries'):
      # known variables only, every { closed, at most MAX_LENGTH characters.
      def self.template_problems(template, variables)
        text = template.to_s
        return [] if text.strip.empty?

        problems = []
        problems << [ :template_too_long, { count: MAX_LENGTH } ] if text.length > MAX_LENGTH
        problems << [ :template_unbalanced_braces, {} ] if text.gsub(TOKEN, "").match?(/[{}]/)
        unknown = text.scan(TOKEN).flatten.map(&:strip).uniq - variables
        problems << [ :template_unknown_variables, { variables: unknown.map { |v| "{#{v}}" }.join(", ") } ] if unknown.any?
        problems
      end

      # Messages for the problems of { locale => template }.
      def self.problem_messages(templates, variables)
        return [ Accounting::CurrencyRevaluation.model_t("errors.template_invalid") ] unless templates.is_a?(Hash)

        templates.flat_map do |locale, template|
          template_problems(template, variables).map do |key, values|
            Accounting::CurrencyRevaluation.model_t("errors.#{key}", language: locale.to_s.upcase, **values)
          end
        end
      end

      # Adds the problems of { locale => template } to record.errors.
      def self.validate(record, attribute, templates, kind)
        problem_messages(templates, VARIABLES.fetch(kind)).each { |message| record.errors.add(attribute, message) }
      end

      def self.built_in(kind, locale)
        Accounting::CurrencyRevaluation.model_t("line_templates.#{kind}", locale: locale)
      end

      def initialize(revaluation)
        @revaluation = revaluation
      end

      def locales
        @locales ||= organization.entry_locales
      end

      # The template used for a kind and locale.
      def template(kind, locale)
        own = kind == "item" ? revaluation.line_description_template : revaluation.counter_line_description_template
        default = kind == "item" ? setting&.revaluation_line_description_template : setting&.revaluation_counter_line_description_template
        own.to_h[locale].presence || default.to_h[locale].presence || self.class.built_in(kind, locale)
      end

      # { locale => text } for an item (CurrencyRevaluationItem or attributes).
      def item(item)
        values = {
          "currency" => currency_abr(item.currency_id),
          "currency_balance" => amount(item.currency_balance, currency_digits(item.currency_id)),
          "book_balance" => amount(item.book_base_balance, main_digits),
          "rate" => item.rate.nil? ? "" : BigDecimal(item.rate.to_s).to_s("F"),
          "rate_date" => item.rate_date&.iso8601.to_s,
          "revalued_balance" => amount(item.revalued_base_balance, main_digits),
          "difference" => amount(item.difference, main_digits)
        }
        render("item", item.account_id, centers_of(item), values)
      end

      # { locale => text } for a counter line.
      def counter(account_id, center_ids, net)
        render("counter", account_id, center_ids, "difference" => amount(net, main_digits))
      end

      private

      attr_reader :revaluation

      def render(kind, account_id, center_ids, values)
        locales.to_h do |locale|
          all = values.merge(
            "as_of_date" => revaluation.as_of_date&.iso8601.to_s,
            "account_code" => account(account_id)&.full_code.to_s,
            "account_name" => translated(account(account_id), locale)
          )
          center_ids.each_with_index do |center_id, index|
            center = center_id && centers[center_id]
            all["center#{index + 1}_code"] = center&.code.to_s
            all["center#{index + 1}_name"] = translated(center, locale)
          end
          text = template(kind, locale).gsub(TOKEN) { all.fetch(Regexp.last_match(1).strip, "") }
          [ locale, text.squish ]
        end
      end

      def centers_of(item)
        (1..6).map { |level| item.public_send("center#{level}_id") }
      end

      def translated(record, locale)
        return "" unless record

        Mobility.with_locale(locale) { record.name.to_s }
      end

      def amount(value, digits)
        return "" if value.nil?

        ActiveSupport::NumberHelper.number_to_rounded(BigDecimal(value.to_s), precision: digits, delimiter: ",")
      end

      def account(id)
        accounts[id] ||= id && Accounting::Account.find_by(id: id)
      end

      def accounts
        @accounts ||= Accounting::Account.where(id: revaluation.items.flat_map { |i| [ i.account_id, i.gain_loss_account_id ] }.compact.uniq)
                                         .index_by(&:id)
      end

      def centers
        @centers ||= Accounting::Center.where(id: revaluation.items.flat_map { |i| centers_of(i) }.compact.uniq).index_by(&:id)
      end

      def currency_abr(id)
        currencies[id]&.abr.to_s
      end

      def currency_digits(id)
        currencies[id]&.decimal_digits || 2
      end

      def currencies
        @currencies ||= Accounting::Currency.where(id: revaluation.items.map(&:currency_id).uniq).index_by(&:id)
      end

      def main_digits
        @main_digits ||= setting&.main_currency&.decimal_digits || 2
      end

      def setting
        organization.accounting_setting
      end

      def organization
        revaluation.organization
      end
    end
  end
end
