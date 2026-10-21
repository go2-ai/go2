require "rails_helper"

# The whole year-end closing, per closing method: foreign currency balances
# revalued as of the year end during the wizard, centers, then temporary
# closing, ending and beginning entries, reopening and closing again.
RSpec.describe "Fiscal year closing: full flow" do
  let(:organization) { create(:organization) }
  let(:setting) { organization.accounting_setting }
  let!(:usd) { setting.main_currency }
  let(:eur) { create(:accounting_currency, organization: organization, abr: "EUR") }
  let(:member) { create(:member, organization: organization, user: create(:user)) }
  let!(:fiscal_year) do
    create(:fiscal_year, organization: organization,
           start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31))
  end
  let!(:next_year) do
    create(:fiscal_year, organization: organization,
           start_date: Date.new(2025, 1, 1), finish_date: Date.new(2025, 12, 31))
  end
  let(:center_type) { create(:accounting_center_type, organization: organization, first_code: "000001", last_code: "000050") }
  let(:branch_a) { create(:accounting_center, center_type: center_type, code: "000001") }
  let(:branch_b) { create(:accounting_center, center_type: center_type, code: "000002") }

  let(:bank) { create_account_in(organization, "CA", ledger_code: "10", monetary: true, name: "Bank") }
  let(:eur_bank) { create_account_in(organization, "CA", ledger_code: "11", monetary: true, name: "EUR bank") }
  let(:revenue) { create_account_in(organization, "RE", ledger_code: "10", name: "Sales") }
  let(:expense) { create_account_in(organization, "EX", ledger_code: "10", name: "Rent") }
  let(:fx_gain) { create_account_in(organization, "RE", ledger_code: "90", name: "FX gain") }
  let(:fx_loss) { create_account_in(organization, "EX", ledger_code: "90", name: "FX loss") }
  let(:retained_earnings) { create_account_in(organization, "OE", ledger_code: "30", name: "Retained earnings") }
  let(:income_summary) { create_account_in(organization, "OE", ledger_code: "40", name: "Income summary") }
  let(:current_year_profit) { create_account_in(organization, "OE", ledger_code: "35", name: "Current year profit") }

  def balances(year, account)
    Accounting::Balances::Query.new(organization: organization, fiscal_year: year, account_ids: [ account.id ]).call
  end

  def base(year, account)
    balances(year, account).sum(BigDecimal("0"), &:base_balance)
  end

  def trial_balance(year)
    Accounting::Balances::Query.new(organization: organization, fiscal_year: year).call.sum(BigDecimal("0"), &:base_balance)
  end

  def income_statement_balance(year)
    Accounting::Balances::Query.new(organization: organization, fiscal_year: year, category_types: %w[income_statement])
                               .call.sum(BigDecimal("0"), &:base_balance)
  end

  def close!
    readiness = Accounting::Closing::Readiness.new(fiscal_year.reload).call
    expect(readiness).to be_ready, readiness.blockers.inspect
    start_closing!(fiscal_year, member: member)

    # At the revaluation step the year-end balances aren't revalued yet; the
    # user revalues them ("Revalue now") and continues.
    expect(Accounting::Closing::RevaluationCheck.new(fiscal_year.reload).call).not_to be_passes
    revaluation = Accounting::CurrencyRevaluation.create!(organization: organization, fiscal_year: fiscal_year,
                                                          as_of_date: fiscal_year.finish_date, kind: :permanent,
                                                          scope: {}, created_by: member)
    Accounting::Revaluation::Preparer.new(revaluation).call
    Accounting::Revaluation::Poster.new(revaluation.reload, member: member).call
    Accounting::Closing::RevaluationStep.new(fiscal_year.reload, member: member).complete!

    temp = Accounting::Closing::TempClosing.new(fiscal_year.reload, member: member)
    expect(temp.plan).to be_postable
    temp.post!(checksum: temp.plan.checksum)

    ending = Accounting::Closing::EndingEntry.new(fiscal_year.reload, member: member)
    expect(ending.plan).to be_postable
    ending.post!(checksum: ending.plan.checksum)

    beginning = Accounting::Closing::BeginningEntry.new(fiscal_year.reload, member: member)
    expect(beginning.plan).to be_postable
    beginning.post!
    fiscal_year.reload
  end

  before do
    setting.update!(default_fx_gain_account: fx_gain, default_fx_loss_account: fx_loss)
    revenue.update!(allowed_center_types_1: [ center_type.id ])
    # Sales: 1,000 at branch A in USD, 110 (100 EUR at 1.1) at branch B to the EUR bank.
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 3, 1), lines: [
      je_line(bank, debit: 1000), je_line(revenue, credit: 1000, centers: { 1 => branch_a })
    ])
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 4, 1), lines: [
      je_line(eur_bank, debit: 110, currency: eur, rate: 1.1),
      je_line(revenue, credit: 110, currency: eur, rate: 1.1, centers: { 1 => branch_b })
    ])
    # Rent 300.
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 5, 1), lines: [
      je_line(expense, debit: 300), je_line(bank, credit: 300)
    ])
    # Year-end rate 1.25: the EUR bank (100 EUR) is worth 125, an FX gain of 15.
    create(:accounting_exchange_rate, organization: organization, currency: eur, date: Date.new(2024, 12, 31), rate: "1.25")
  end

  # Profit: 1,000 + 110 − 300 + 15 FX gain = 825.
  shared_examples "a complete closing" do |equity_account|
    it "closes the year and opens the next one with the year-end balances" do
      close!
      equity = public_send(equity_account)

      expect(fiscal_year).to have_attributes(status: "closed", closing_step: "finalized")
      expect(fiscal_year.closing_data.dig("temp_closing", "net_result")).to eq("825.0")
      expect(income_statement_balance(fiscal_year)).to eq(0)
      expect(base(fiscal_year, income_summary)).to eq(0)
      expect(trial_balance(fiscal_year)).to eq(0)
      expect(Accounting::Balances::Query.new(organization: organization, fiscal_year: fiscal_year).call).to be_empty

      expect(base(next_year, bank)).to eq(700)
      eur_row = balances(next_year, eur_bank).sole
      expect([ eur_row.currency_id, eur_row.base_balance, eur_row.currency_balance ]).to eq([ eur.id, 125, 100 ])
      expect(base(next_year, equity)).to eq(-825)
      expect(trial_balance(next_year)).to eq(0)
      expect(income_statement_balance(next_year)).to eq(0)
    end

    it "can be undone and closed again with the same result" do
      close!
      Accounting::Closing::Rollback.reopen_fully!(fiscal_year)
      expect(fiscal_year.reload).to be_open
      expect(next_year.journal_entries).to be_empty

      # The year-end revaluation is kept; remove it so close! can post it again.
      Accounting::Revaluation::Remover.new(Accounting::CurrencyRevaluation.sole).call
      close!
      expect(base(next_year, public_send(equity_account))).to eq(-825)
      expect(trial_balance(next_year)).to eq(0)
    end
  end

  context "with the direct method" do
    before { setting.update!(closing_method: :direct, retained_earnings_account: retained_earnings) }

    it_behaves_like "a complete closing", :retained_earnings
  end

  context "with an income summary" do
    before do
      setting.update!(closing_method: :income_summary, retained_earnings_account: retained_earnings,
                      income_summary_account: income_summary)
    end

    it_behaves_like "a complete closing", :retained_earnings

    it "posts two temporary closing entries" do
      close!
      expect(fiscal_year.closing_entries.where(entry_type: :closing_temp_accounts).count).to eq(2)
    end
  end

  context "with a current year profit account" do
    before do
      setting.update!(closing_method: :current_year_profit, retained_earnings_account: retained_earnings,
                      current_year_profit_account: current_year_profit)
    end

    it_behaves_like "a complete closing", :current_year_profit

    it "leaves retained earnings untouched" do
      close!
      expect(base(next_year, retained_earnings)).to eq(0)
    end
  end
end
