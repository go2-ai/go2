require "rails_helper"

RSpec.describe Accounting::Explorer::GroupedSummaryQuery do
  let(:organization) { create(:organization) }
  let!(:fiscal_year) do
    create(:fiscal_year, organization: organization,
           start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31))
  end

  let(:bank) { create_account_in(organization, "CA", ledger_code: "10", name: "Bank") }
  let(:cash) { create_account_in(organization, "CA", ledger_code: "10", account_code: "02", name: "Cash") }
  let(:revenue) { create_account_in(organization, "RE", ledger_code: "10", name: "Sales") }

  def rows(**options)
    scope = Accounting::Explorer::EntryScope.new(organization: organization, fiscal_year_id: fiscal_year.id)
    described_class.new(organization: organization, scope: scope, group_by: "account", **options).call
  end

  def row_for(rows, account)
    rows.find { |r| r[:id] == account.id }
  end

  it "computes balances with exact decimals" do
    # In floats 100000000000000.07 - 0.01 rounds to ...0.05.
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 3, 1), lines: [
      je_line(bank, debit: BigDecimal("100000000000000.07")), je_line(revenue, credit: BigDecimal("100000000000000.07"))
    ])
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 3, 2), lines: [
      je_line(revenue, debit: BigDecimal("0.01")), je_line(bank, credit: BigDecimal("0.01"))
    ])

    bank_row = row_for(rows, bank)
    expect(bank_row[:debit_balance]).to eq(100_000_000_000_000.06)
    expect(bank_row[:credit_balance]).to be_nil
    expect(row_for(rows, revenue)[:credit_balance]).to eq(100_000_000_000_000.06)
  end

  describe "hide_zero_balance" do
    before do
      # Cash nets to zero: 0.1 + 0.2 in, 0.3 out.
      post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 3, 1), lines: [
        je_line(cash, debit: BigDecimal("0.1")), je_line(cash, debit: BigDecimal("0.2")),
        je_line(revenue, credit: BigDecimal("0.3"))
      ])
      post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 3, 2), lines: [
        je_line(bank, debit: BigDecimal("0.3")), je_line(cash, credit: BigDecimal("0.3"))
      ])
    end

    it "keeps zero-balance rows by default" do
      cash_row = row_for(rows, cash)
      expect(cash_row).to include(sum_debit: 0.3, sum_credit: 0.3, debit_balance: nil, credit_balance: nil)
    end

    it "leaves out rows whose debit and credit net to zero" do
      result = rows(hide_zero_balance: true)
      expect(result.map { |r| r[:id] }).to contain_exactly(bank.id, revenue.id)
    end
  end
end
