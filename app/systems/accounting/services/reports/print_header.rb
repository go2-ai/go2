module Accounting
  module Reports
    # The header fields every reporting print shares (the `summary` data
    # source of ExplorerPrintTemplate). Build inside the template's locale.
    module PrintHeader
      module_function

      def call(organization:, from: nil, to: nil, approved_only: false)
        currency = organization.accounting_setting&.main_currency
        {
          organization_name: organization.name,
          from: from&.to_s, to: to&.to_s,
          entry_types_text: "", filters: [],
          approved_only: approved_only,
          states_text: I18n.t(approved_only ? "reports.shared.states_names.approved" : "reports.shared.states_names.booked_and_approved"),
          currency: currency && { abr: currency.abr, name: currency.name, names: currency.read_attribute(:name) || {},
                                  decimal_digits: currency.decimal_digits }
        }
      end

      # "As of 2024-12-31" or "2024-01-01 to 2024-12-31".
      def column_title(column)
        column = column.with_indifferent_access
        if column[:as_of]
          I18n.t("reports.financial_statement.as_of", date: column[:as_of])
        else
          I18n.t("reports.financial_statement.period", from: column[:from], to: column[:to])
        end
      end
    end
  end
end
