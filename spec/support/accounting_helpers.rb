# Helpers for specs that need posted journal entries.
module AccountingHelpers
  # Creates a journal entry with the given lines in one save.
  #
  #   post_entry(fiscal_year: fy, date: Date.new(2024, 3, 1), lines: [
  #     je_line(bank, debit: 5000, currency: usd, rate: 50),
  #     je_line(revenue, credit: 5000)
  #   ])
  #
  # Main-currency lines get rate nil; foreign lines derive currency_amount
  # from the rate unless the entry is system generated (pass source: and
  # system_context:), in which case currency_amount is taken as given.
  def post_entry(fiscal_year:, date:, lines:, state: :approved, organization: fiscal_year.organization, **attrs)
    entry = build(:accounting_journal_entry, organization: organization, fiscal_year: fiscal_year,
                  date: date, state: state, **attrs)
    lines.each_with_index do |line, index|
      entry.items.build(line.merge(row: index + 1))
    end
    entry.save!
    entry
  end

  def je_line(account, debit: 0, credit: 0, currency: nil, rate: nil, currency_amount: nil, centers: {})
    line = { account: account, debit: debit, credit: credit, rate: rate }
    line[:currency] = currency if currency
    line[:currency_amount] = currency_amount unless currency_amount.nil?
    centers.each { |level, center| line[:"center#{level}"] = center }
    line
  end

  # Starts closing a fiscal year and skips the optional renumbering, so the
  # year is at the revaluation step.
  def start_closing!(fiscal_year, member:)
    Accounting::Closing::Starter.new(fiscal_year, member: member).call
    Accounting::Closing::Renumberer.new(fiscal_year.reload, member: member).skip!
    fiscal_year.reload
  end

  # A ledger (and one account in it) under a system category, e.g. "CA".
  def create_account_in(organization, identifier, ledger_code:, account_code: "01", monetary: false, name: nil)
    category = organization.account_categories.find_by!(identifier: identifier)
    ledger = Accounting::Ledger.find_by(account_category: category, code: ledger_code) ||
             create(:accounting_ledger, account_category: category, code: ledger_code, is_monetary: monetary)
    create(:accounting_account, ledger: ledger, code: account_code, accepts_other_currencies: true,
           name: { en: name || "#{identifier} #{ledger_code}#{account_code}" })
  end
end

RSpec.configure do |config|
  config.include AccountingHelpers
end
