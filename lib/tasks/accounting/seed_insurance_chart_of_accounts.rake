namespace :accounting do
  namespace :chart_of_accounts do
    desc "Build the default IFRS 17 insurance chart of accounts for an organization"

    task :seed_insurance, [:organization_id] => :environment do |_task, args|
      organization_id = args[:organization_id]

      abort "Organization ID is required." if organization_id.blank?

      organization = Organization.find_by(id: organization_id)

      abort "Organization #{organization_id} was not found." unless organization

      puts "Building insurance chart of accounts for #{organization.name} (ID: #{organization.id})..."

      #
      # IMPORTANT
      #
      # Codes below represent LOCAL codes only.
      #
      # Account Category:
      #   1
      #
      # Ledger:
      #   01
      #
      # Account:
      #   01
      #
      # Full codes are expected to be computed by the application:
      #
      #   Category: 1
      #   Ledger:   01  => 101
      #   Account:  01  => 10101
      #

      chart = {
        "CA" => {
          ledgers: [
            {
              code: "01",
              name: "Cash and Cash Equivalents",
              is_monetary: true,
              accounts: [
                ["01", "Cash on Hand", true],
                ["02", "Bank Current Accounts", true],
                ["03", "Bank Savings Accounts", true],
                ["04", "Call Deposits", true],
                ["05", "Short-term Deposits", true],
                ["06", "Cash in Transit", true],
                ["07", "Restricted Cash", true],
                ["08", "Petty Cash", true]
              ]
            },
            {
              code: "02",
              name: "Premium and Insurance Receivables",
              is_monetary: true,
              accounts: [
                ["01", "Premiums Receivable", true],
                ["02", "Outstanding Premiums Receivable", true],
                ["03", "Due from Policyholders", true],
                ["04", "Due from Insurance Brokers", true],
                ["05", "Due from Agents", true],
                ["06", "Premium Receivables – Related Parties", true],
                ["07", "Allowance for Expected Credit Losses", true]
              ]
            },
            {
              code: "03",
              name: "Reinsurance Receivables",
              is_monetary: true,
              accounts: [
                ["01", "Reinsurance Recoverables", true],
                ["02", "Reinsurance Premium Receivable", true],
                ["03", "Reinsurance Claims Recoverable", true],
                ["04", "Reinsurance Commissions Receivable", true],
                ["05", "Reinsurance Contract Assets", true],
                ["06", "Allowance for Reinsurance Credit Losses", true]
              ]
            },
            {
              code: "04",
              name: "Other Receivables",
              is_monetary: true,
              accounts: [
                ["01", "Trade Receivables", true],
                ["02", "Interest Receivable", true],
                ["03", "Dividends Receivable", true],
                ["04", "Rent Receivable", true],
                ["05", "VAT Receivable", true],
                ["06", "Tax Receivable", true],
                ["07", "Employee Receivables", true],
                ["08", "Other Receivables", true],
                ["09", "Deposits Receivable", true]
              ]
            },
            {
              code: "05",
              name: "Prepayments",
              is_monetary: false,
              accounts: [
                ["01", "Prepaid Insurance", false],
                ["02", "Prepaid Rent", false],
                ["03", "Prepaid Software", false],
                ["04", "Prepaid Professional Fees", false],
                ["05", "Prepaid Operating Expenses", false],
                ["06", "Other Prepayments", false]
              ]
            },
            {
              code: "06",
              name: "Current Tax Assets",
              is_monetary: true,
              accounts: [
                ["01", "Current Income Tax Receivable", true],
                ["02", "Tax Refund Receivable", true],
                ["03", "Other Tax Receivable", true]
              ]
            },
            {
              code: "07",
              name: "Other Current Assets",
              is_monetary: false,
              accounts: [
                ["01", "Deferred Acquisition Cash Flows – Current", false],
                ["02", "Insurance Acquisition Assets – Current", false],
                ["03", "Assets Held for Sale", false],
                ["04", "Other Current Assets", false]
              ]
            }
          ]
        },

        "LA" => {
          ledgers: [
            {
              code: "01",
              name: "Financial Assets at FVTPL",
              accounts: [
                ["01", "Government Bonds – FVTPL"],
                ["02", "Corporate Bonds – FVTPL"],
                ["03", "Equity Securities – FVTPL"],
                ["04", "Mutual Funds – FVTPL"],
                ["05", "Structured Products – FVTPL"],
                ["06", "Other Financial Assets – FVTPL"]
              ]
            },
            {
              code: "02",
              name: "Financial Assets at FVOCI",
              accounts: [
                ["01", "Government Bonds – FVOCI"],
                ["02", "Corporate Bonds – FVOCI"],
                ["03", "Equity Investments – FVOCI"],
                ["04", "Other Financial Assets – FVOCI"]
              ]
            },
            {
              code: "03",
              name: "Financial Assets at Amortised Cost",
              accounts: [
                ["01", "Government Bonds – Amortised Cost"],
                ["02", "Corporate Bonds – Amortised Cost"],
                ["03", "Term Deposits"],
                ["04", "Other Debt Instruments"],
                ["05", "Expected Credit Loss Allowance"]
              ]
            },
            {
              code: "04",
              name: "Investments in Associates and Joint Ventures",
              accounts: [
                ["01", "Investment in Associates"],
                ["02", "Investment in Joint Ventures"]
              ]
            },
            {
              code: "05",
              name: "Investment Properties",
              accounts: [
                ["01", "Investment Land"],
                ["02", "Investment Buildings"],
                ["03", "Investment Property Under Construction"],
                ["04", "Accumulated Fair Value Adjustments"]
              ]
            },
            {
              code: "06",
              name: "Property, Plant and Equipment",
              accounts: [
                ["01", "Land"],
                ["02", "Buildings"],
                ["03", "Leasehold Improvements"],
                ["04", "Furniture and Fixtures"],
                ["05", "Office Equipment"],
                ["06", "Computer Equipment"],
                ["07", "Motor Vehicles"],
                ["08", "Other Equipment"],
                ["90", "Accumulated Depreciation – Buildings"],
                ["91", "Accumulated Depreciation – Leasehold Improvements"],
                ["92", "Accumulated Depreciation – Furniture"],
                ["93", "Accumulated Depreciation – Equipment"],
                ["94", "Accumulated Depreciation – Vehicles"]
              ]
            },
            {
              code: "07",
              name: "Right-of-Use Assets",
              accounts: [
                ["01", "Right-of-Use Asset – Buildings"],
                ["02", "Right-of-Use Asset – Vehicles"],
                ["03", "Right-of-Use Asset – Equipment"],
                ["90", "Accumulated Depreciation – ROU Assets"]
              ]
            },
            {
              code: "08",
              name: "Intangible Assets",
              accounts: [
                ["01", "Goodwill"],
                ["02", "Software"],
                ["03", "Internally Developed Software"],
                ["04", "Licenses"],
                ["05", "Patents"],
                ["06", "Trademarks"],
                ["07", "Customer Relationships"],
                ["90", "Accumulated Amortisation – Software"],
                ["91", "Accumulated Amortisation – Licenses"],
                ["92", "Accumulated Amortisation – Other Intangibles"]
              ]
            },
            {
              code: "09",
              name: "Deferred Tax Assets",
              is_monetary: false,
              accounts: [
                ["01", "Deferred Tax Asset"],
                ["02", "Deferred Tax Asset – Tax Losses"],
                ["03", "Deferred Tax Asset – Temporary Differences"]
              ]
            }
          ]
        },

        "CL" => {
          ledgers: [
            {
              code: "01",
              name: "Trade and Other Payables",
              is_monetary: true,
              accounts: [
                ["01", "Trade Payables", true],
                ["02", "Accounts Payable", true],
                ["03", "Accrued Expenses", true],
                ["04", "Accrued Professional Fees", true],
                ["05", "Accrued Audit Fees", true],
                ["06", "Other Payables", true]
              ]
            },
            {
              code: "02",
              name: "Insurance Contract Liabilities",
              accounts: [
                ["01", "Liability for Remaining Coverage"],
                ["02", "Liability for Incurred Claims"],
                ["03", "Insurance Contract Liability – GMM"],
                ["04", "Insurance Contract Liability – PAA"],
                ["05", "Insurance Contract Liability – VFA"],
                ["06", "Loss Component"],
                ["07", "Risk Adjustment"],
                ["08", "Contractual Service Margin"]
              ]
            },
            {
              code: "03",
              name: "Reinsurance Contract Liabilities",
              accounts: [
                ["01", "Reinsurance Contract Liability"],
                ["02", "Reinsurance Liability – Remaining Coverage"],
                ["03", "Reinsurance Liability – Incurred Claims"],
                ["04", "Reinsurance Ceded Premium Payable"]
              ]
            },
            {
              code: "04",
              name: "Current Tax Liabilities",
              is_monetary: true,
              accounts: [
                ["01", "Income Tax Payable", true],
                ["02", "VAT Payable", true],
                ["03", "Payroll Tax Payable", true],
                ["04", "Other Taxes Payable", true]
              ]
            },
            {
              code: "05",
              name: "Employee Liabilities",
              is_monetary: true,
              accounts: [
                ["01", "Salaries Payable", true],
                ["02", "Bonuses Payable", true],
                ["03", "Annual Leave Provision", true],
                ["04", "Employee Benefits Payable", true],
                ["05", "Pension Contributions Payable", true]
              ]
            },
            {
              code: "06",
              name: "Provisions",
              accounts: [
                ["01", "Legal Provisions"],
                ["02", "Restructuring Provisions"],
                ["03", "Other Operating Provisions"]
              ]
            },
            {
              code: "07",
              name: "Other Current Liabilities",
              accounts: [
                ["01", "Unearned Other Revenue"],
                ["02", "Deferred Income"],
                ["03", "Deposits Received"],
                ["04", "Other Current Liabilities"]
              ]
            }
          ]
        },

        "LL" => {
          ledgers: [
            {
              code: "01",
              name: "Borrowings",
              accounts: [
                ["01", "Bank Loans"],
                ["02", "Long-term Loans"],
                ["03", "Bonds Payable"],
                ["04", "Other Borrowings"]
              ]
            },
            {
              code: "02",
              name: "Lease Liabilities",
              accounts: [
                ["01", "Lease Liability – Buildings"],
                ["02", "Lease Liability – Vehicles"],
                ["03", "Lease Liability – Equipment"]
              ]
            },
            {
              code: "03",
              name: "Long-term Insurance Contract Liabilities",
              accounts: [
                ["01", "Insurance Contract Liability – Long-term"],
                ["02", "Liability for Remaining Coverage – Long-term"],
                ["03", "Liability for Incurred Claims – Long-term"]
              ]
            },
            {
              code: "04",
              name: "Deferred Tax Liabilities",
              accounts: [
                ["01", "Deferred Tax Liability"],
                ["02", "Deferred Tax Liability – Fair Value Adjustments"],
                ["03", "Deferred Tax Liability – Other Temporary Differences"]
              ]
            },
            {
              code: "05",
              name: "Long-term Employee Benefits",
              accounts: [
                ["01", "Long-term Employee Benefits"],
                ["02", "Defined Benefit Obligation"],
                ["03", "Long-service Leave Provision"]
              ]
            }
          ]
        },

        "OE" => {
          ledgers: [
            {
              code: "01",
              name: "Share Capital",
              accounts: [
                ["01", "Ordinary Share Capital"],
                ["02", "Preference Share Capital"],
                ["03", "Share Premium"]
              ]
            },
            {
              code: "02",
              name: "Capital Reserves",
              accounts: [
                ["01", "Share-based Payment Reserve"],
                ["02", "Capital Contribution Reserve"],
                ["03", "Other Capital Reserve"]
              ]
            },
            {
              code: "03",
              name: "Other Comprehensive Income Reserves",
              accounts: [
                ["01", "FVOCI Reserve"],
                ["02", "Cash Flow Hedge Reserve"],
                ["03", "Foreign Currency Translation Reserve"],
                ["04", "Insurance Finance OCI Reserve"],
                ["05", "Revaluation Reserve"]
              ]
            },
            {
              code: "04",
              name: "Retained Earnings",
              accounts: [
                ["01", "Retained Earnings – Prior Years"],
                ["02", "Current Year Profit"],
                ["03", "Prior Period Adjustments"]
              ]
            },
            {
              code: "05",
              name: "Non-controlling Interests",
              accounts: [
                ["01", "Non-controlling Interest"]
              ]
            },
            {
              code: "06",
              name: "Dividends",
              accounts: [
                ["01", "Dividends Declared"],
                ["02", "Dividends Payable"]
              ]
            }
          ]
        },

        "RE" => {
          ledgers: [
            {
              code: "01",
              name: "Insurance Revenue",
              accounts: [
                ["01", "Life Insurance Revenue"],
                ["02", "Life Savings Insurance Revenue"],
                ["03", "Participating Insurance Revenue"],
                ["04", "Motor Insurance Revenue"],
                ["05", "Property Insurance Revenue"],
                ["06", "Other Non-life Insurance Revenue"]
              ]
            },
            {
              code: "02",
              name: "Investment Income",
              accounts: [
                ["01", "Dividend Income"],
                ["02", "Interest Income"],
                ["03", "Rental Income"],
                ["04", "Other Investment Income"]
              ]
            },
            {
              code: "03",
              name: "Fair Value and Investment Gains",
              accounts: [
                ["01", "Fair Value Gain – FVTPL"],
                ["02", "Fair Value Gain – Investment Property"],
                ["03", "Gain on Disposal of Financial Assets"],
                ["04", "Gain on Disposal of Investment Property"],
                ["05", "Foreign Exchange Gain"]
              ]
            },
            {
              code: "04",
              name: "Reinsurance Income",
              accounts: [
                ["01", "Reinsurance Recoveries"],
                ["02", "Reinsurance Commission Income"],
                ["03", "Finance Income from Reinsurance Contracts"],
                ["04", "Reinsurance Contract Service Income"]
              ]
            },
            {
              code: "05",
              name: "Other Operating Income",
              accounts: [
                ["01", "Management Fees"],
                ["02", "Administrative Service Income"],
                ["03", "Other Operating Income"]
              ]
            },
            {
              code: "06",
              name: "Equity-accounted Investment Income",
              accounts: [
                ["01", "Share of Profit – Associates"],
                ["02", "Share of Profit – Joint Ventures"]
              ]
            }
          ]
        },

        "EX" => {
          ledgers: [
            {
              code: "01",
              name: "Insurance Service Expenses",
              accounts: [
                ["01", "Claims and Benefits Incurred"],
                ["02", "Claims Handling Costs"],
                ["03", "Policyholder Benefits"],
                ["04", "Insurance Acquisition Costs"],
                ["05", "Policy Administration Costs"],
                ["06", "Changes in Insurance Contract Estimates"],
                ["07", "Risk Adjustment Expense"],
                ["08", "Other Insurance Service Expenses"]
              ]
            },
            {
              code: "02",
              name: "Reinsurance Expenses",
              accounts: [
                ["01", "Reinsurance Premium Expense"],
                ["02", "Net Expenses from Reinsurance Contracts"],
                ["03", "Reinsurance Acquisition Costs"],
                ["04", "Reinsurance Contract Service Expense"]
              ]
            },
            {
              code: "03",
              name: "Insurance Finance Expenses",
              accounts: [
                ["01", "Finance Expense – Insurance Contracts"],
                ["02", "Interest Accretion – Insurance Liabilities"],
                ["03", "Discount Rate Changes – Insurance Contracts"],
                ["04", "Insurance Finance OCI Expense"]
              ]
            },
            {
              code: "04",
              name: "Investment Expenses and Losses",
              accounts: [
                ["01", "Investment Impairment"],
                ["02", "Fair Value Loss – Financial Assets"],
                ["03", "Fair Value Loss – Investment Property"],
                ["04", "Loss on Disposal of Financial Assets"],
                ["05", "Investment Management Fees"]
              ]
            },
            {
              code: "05",
              name: "Employee Expenses",
              accounts: [
                ["01", "Salaries and Wages"],
                ["02", "Bonuses"],
                ["03", "Social Security Costs"],
                ["04", "Pension Costs"],
                ["05", "Employee Benefits"],
                ["06", "Training and Development"]
              ]
            },
            {
              code: "06",
              name: "Administrative Expenses",
              accounts: [
                ["01", "Rent Expense"],
                ["02", "Utilities"],
                ["03", "Office Supplies"],
                ["04", "IT Expenses"],
                ["05", "Software Subscriptions"],
                ["06", "Professional Fees"],
                ["07", "Audit Fees"],
                ["08", "Legal Fees"],
                ["09", "Consulting Fees"],
                ["10", "Insurance Expense"],
                ["11", "Communication Expense"],
                ["12", "Travel and Entertainment"],
                ["13", "Marketing Expense"],
                ["14", "Other Administrative Expenses"]
              ]
            },
            {
              code: "07",
              name: "Depreciation and Amortisation",
              accounts: [
                ["01", "Depreciation – Buildings"],
                ["02", "Depreciation – Equipment"],
                ["03", "Depreciation – Vehicles"],
                ["04", "Depreciation – ROU Assets"],
                ["05", "Amortisation – Software"],
                ["06", "Amortisation – Other Intangibles"]
              ]
            },
            {
              code: "08",
              name: "Finance Expenses",
              accounts: [
                ["01", "Interest Expense – Borrowings"],
                ["02", "Interest Expense – Lease Liabilities"],
                ["03", "Bank Charges"],
                ["04", "Foreign Exchange Loss"],
                ["05", "Other Finance Costs"]
              ]
            },
            {
              code: "09",
              name: "Other Operating Expenses",
              accounts: [
                ["01", "Other Operating Expenses"],
                ["02", "Fines and Penalties"],
                ["03", "Donations"],
                ["04", "Loss on Disposal of Assets"]
              ]
            }
          ]
        },

        "CO" => {
          ledgers: [
            {
              code: "01",
              name: "Claims Costs",
              accounts: [
                ["01", "Gross Claims Paid"],
                ["02", "Claims Handling Costs"],
                ["03", "Claims Investigation Costs"],
                ["04", "Claims Settlement Costs"]
              ]
            },
            {
              code: "02",
              name: "Policy Acquisition Costs",
              accounts: [
                ["01", "Agent Commissions"],
                ["02", "Broker Commissions"],
                ["03", "Underwriting Costs"],
                ["04", "Policy Issuance Costs"],
                ["05", "Direct Marketing Costs"]
              ]
            },
            {
              code: "03",
              name: "Policy Servicing Costs",
              accounts: [
                ["01", "Policy Administration Costs"],
                ["02", "Customer Service Costs"],
                ["03", "Policy Maintenance Costs"]
              ]
            }
          ]
        },

        "ME" => {
          ledgers: [
            {
              code: "01",
              name: "Underwriting Statistics",
              accounts: [
                ["01", "Policies in Force"],
                ["02", "New Policies Issued"],
                ["03", "Policies Cancelled"],
                ["04", "Claims Reported"],
                ["05", "Claims Settled"]
              ]
            },
            {
              code: "02",
              name: "Insurance Exposure",
              accounts: [
                ["01", "Sum Insured"],
                ["02", "Gross Written Premium Statistics"],
                ["03", "Reinsurance Coverage Statistics"]
              ]
            },
            {
              code: "03",
              name: "Commitments and Contingencies",
              accounts: [
                ["01", "Investment Commitments"],
                ["02", "Capital Commitments"],
                ["03", "Operating Lease Commitments"],
                ["04", "Guarantees Issued"]
              ]
            }
          ]
        }
      }.freeze

      ActiveRecord::Base.transaction do
        chart.each do |category_identifier, category_definition|
          category = Accounting::AccountCategory.find_by(
            organization: organization,
            identifier: category_identifier
          )

          unless category
            raise(
              "System account category '#{category_identifier}' was not found " \
              "for organization #{organization.id}"
            )
          end

          puts "Processing category #{category_identifier}: #{category.name}"

          category_definition[:ledgers].each do |ledger_definition|
            ledger = category.ledgers.find_or_initialize_by(
              code: ledger_definition[:code]
            )

            if ledger.new_record?
              ledger.name = ledger_definition[:name]

              ledger.unexpected_balance = :warn
              ledger.is_monetary = ledger_definition.fetch(:is_monetary, false)

              ledger.save!

              puts "  Created ledger #{ledger_definition[:code]}: #{ledger_definition[:name]}"
            else
              puts "  Ledger already exists #{ledger_definition[:code]}, skipping"
            end

            ledger_definition[:accounts].each do |account_definition|
              account_code = account_definition[0]
              account_name = account_definition[1]
              accepts_other_currencies = account_definition.fetch(
                2,
                ledger_definition.fetch(:is_monetary, false)
              )

              account = ledger.accounts.find_or_initialize_by(
                code: account_code
              )

              if account.new_record?
                account.name = account_name

                account.accepts_other_currencies = accepts_other_currencies

                account.save!

                puts "    Created account #{account_code}: #{account_name}"
              else
                puts "    Account already exists #{account_code}, skipping"
              end
            end
          end
        end
      end

      puts
      puts "=" * 80
      puts "Insurance chart of accounts successfully created."
      puts "=" * 80

      puts
      puts "Summary:"

      Accounting::AccountCategory
        .where(organization: organization)
        .order(:code)
        .each do |category|

        ledger_count = category.ledgers.count

        account_count = Accounting::Account
          .where(ledger_id: category.ledgers.select(:id))
          .count

        puts "#{category.code} #{category.identifier} - #{ledger_count} ledgers, #{account_count} accounts"
      end
    end
  end
end