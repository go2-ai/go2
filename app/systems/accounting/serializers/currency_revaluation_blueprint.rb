module Accounting
  class CurrencyRevaluationBlueprint < Blueprinter::Base
    identifier :id
    fields :fiscal_year_id, :as_of_date, :kind, :status, :scope, :created_by_id, :posted_by_id,
           :posted_at, :superseded_at, :created_at, :updated_at, :schedule_id
    field :translations_hash, name: :t
    field :journal_entry_id do |revaluation|
      revaluation.journal_entry&.id
    end
    field :journal_entry_no do |revaluation|
      revaluation.journal_entry&.no
    end
    field :journal_entry_ref do |revaluation|
      revaluation.journal_entry&.ref
    end
    # Of the items that are (or were) posted.
    field :total_difference do |revaluation|
      revaluation.postable_items.sum(BigDecimal("0"), &:difference).to_s("F")
    end
    field :items_count do |revaluation|
      revaluation.items.size
    end
    field :excluded_count do |revaluation|
      revaluation.items.count { |item| item.excluded? && !item.removed? }
    end
    field :removed_count do |revaluation|
      revaluation.items.count(&:removed?)
    end

    view :show do
      association :items, blueprint: Accounting::CurrencyRevaluationItemBlueprint
      # { locale => template }; blank locales use default_line_templates.
      fields :line_description_template, :counter_line_description_template
      # What blank locales use: the organization default or the built-in one.
      field :default_line_templates do |revaluation|
        organization = revaluation.organization
        setting = organization.accounting_setting
        locales = organization.entry_locales
        {
          item: locales.to_h do |locale|
            [ locale, setting&.revaluation_line_description_template.to_h[locale.to_s].presence ||
                      Accounting::Revaluation::LineDescriptions.built_in("item", locale) ]
          end,
          counter: locales.to_h do |locale|
            [ locale, setting&.revaluation_counter_line_description_template.to_h[locale.to_s].presence ||
                      Accounting::Revaluation::LineDescriptions.built_in("counter", locale) ]
          end
        }
      end
    end

    # Data for printed reports (Ariana Reports templates read it as `root`).
    # Amounts are numbers so templates can format and sum them.
    view :print do
      excludes :scope, :created_by_id, :posted_by_id, :created_at, :updated_at, :schedule_id, :t
      field :as_of_date do |revaluation| revaluation.as_of_date&.iso8601 end
      field :posted_at do |revaluation| revaluation.posted_at&.strftime("%Y-%m-%d %H:%M") end
      field :kind_name do |revaluation|
        Accounting::CurrencyRevaluation.model_t("kinds.#{revaluation.kind}")
      end
      field :status_name do |revaluation|
        Accounting::CurrencyRevaluation.model_t("statuses.#{revaluation.status}")
      end
      field :description do |revaluation| revaluation.description end
      field :organization_name do |revaluation| revaluation.organization.name end
      field :created_by do |revaluation| revaluation.created_by&.name end
      field :posted_by do |revaluation| revaluation.posted_by&.name end
      field :total_difference do |revaluation|
        revaluation.postable_items.sum(BigDecimal("0"), &:difference).to_f
      end
      field :total_gain do |revaluation|
        revaluation.postable_items.select { |item| item.difference.positive? }.sum(BigDecimal("0"), &:difference).to_f
      end
      field :total_loss do |revaluation|
        revaluation.postable_items.select { |item| item.difference.negative? }.sum(BigDecimal("0"), &:difference).abs.to_f
      end
      field :currency do |revaluation|
        currency = revaluation.organization.accounting_setting&.main_currency
        next nil unless currency

        { abr: currency.abr, name: currency.name, names: currency.read_attribute(:name) || {},
          decimal_digits: currency.decimal_digits }
      end
      association :items, blueprint: Accounting::CurrencyRevaluationItemBlueprint, view: :print do |revaluation|
        revaluation.items.reject(&:removed?)
      end
    end
  end
end
