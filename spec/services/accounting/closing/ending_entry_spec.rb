require "rails_helper"

RSpec.describe Accounting::Closing::EndingEntry do
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
  let(:bank) { create_account_in(organization, "CA", ledger_code: "10", monetary: true, name: "Bank") }
  let(:inventory) { create_account_in(organization, "CA", ledger_code: "20", name: "Inventory") }
  let(:revenue) { create_account_in(organization, "RE", ledger_code: "10", name: "Sales") }
  let(:retained_earnings) { create_account_in(organization, "OE", ledger_code: "30", name: "Retained earnings") }
  let(:center_type) { create(:accounting_center_type, organization: organization, first_code: "000001", last_code: "000050") }
  let(:branch) { create(:accounting_center, center_type: center_type, code: "000001") }

  def to_ending!
    setting.update!(closing_method: :direct, retained_earnings_account: retained_earnings)
    start_closing!(fiscal_year, member: member)
    Accounting::Closing::RevaluationStep.new(fiscal_year.reload, member: member).complete!
    temp = Accounting::Closing::TempClosing.new(fiscal_year.reload, member: member)
    temp.post!(checksum: temp.plan.checksum)
    fiscal_year.reload
  end

  def service
    described_class.new(fiscal_year.reload, member: member)
  end

  def post!
    service.post!(checksum: service.plan.checksum)
  end

  def balances(account)
    Accounting::Balances::Query.new(organization: organization, fiscal_year: fiscal_year, account_ids: [ account.id ],
                                    include_zero: true).call.map { |r| [ r.base_balance, r.currency_balance ] }
  end

  def expect_closing_error(key)
    expect { yield }.to raise_error(Accounting::Closing::Error) { |e| expect(e.key).to eq(key) }
  end

  before do
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 3, 1), lines: [
      je_line(bank, debit: 110), je_line(revenue, credit: 110)
    ])
  end

  it "brings every permanent balance to zero and moves to the beginning step" do
    to_ending!
    plan = service.plan
    expect(plan).to be_postable
    expect(plan.lines.map { |l| [ l[:account_id], l[:debit], l[:credit] ] })
      .to contain_exactly([ bank.id, 0, 110 ], [ retained_earnings.id, 110, 0 ])

    post!
    entry = fiscal_year.closing_entries.find_by!(entry_type: :ending)
    expect(entry).to have_attributes(state: "approved", date: Date.new(2024, 12, 31), source: fiscal_year)
    expect(fiscal_year.reload.closing_step).to eq("beginning")
    expect(fiscal_year.closing_data.dig("ending", "entry_id")).to eq(entry.id)
    expect(balances(bank)).to eq([ [ 0, 0 ] ])
    expect(balances(retained_earnings)).to eq([ [ 0, 0 ] ])
  end

  it "keeps foreign amounts and centers" do
    inventory.update!(allowed_center_types_1: [ center_type.id ])
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 4, 1), lines: [
      je_line(inventory, debit: 55, currency: eur, rate: 1.1, centers: { 1 => branch }), je_line(bank, credit: 55)
    ])
    to_ending!
    line = service.plan.lines.find { |l| l[:account_id] == inventory.id }
    expect(line).to include(currency_id: eur.id, credit: 55, currency_amount: 50, center1_id: branch.id)
    post!
    expect(balances(inventory)).to eq([ [ 0, 0 ] ])
  end

  it "closes opposite base and foreign signs with a pair of lines" do
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 4, 1), lines: [
      je_line(inventory, debit: 100, currency: eur, rate: 1), je_line(inventory, credit: 110, currency: eur, rate: 1.22222222222222),
      je_line(bank, debit: 10)
    ])
    to_ending!
    expect(service.plan.lines.count { |l| l[:account_id] == inventory.id }).to eq(2)
    post!
    expect(balances(inventory)).to eq([ [ 0, 0 ] ])
  end

  it "refuses while temporary accounts have balances" do
    to_ending!
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 12, 31), source: fiscal_year, system_context: :fiscal_year_closing,
               lines: [ je_line(bank, debit: 5), je_line(revenue, credit: 5) ])
    plan = service.plan
    expect(plan).not_to be_postable
    expect(plan.open_temporary).to contain_exactly(include(account_id: revenue.id, base_balance: "-5.0"))
    expect_closing_error(:temporary_accounts_open) { service.post!(checksum: plan.checksum) }
  end

  it "refuses a stale preview" do
    to_ending!
    expect_closing_error(:stale) { service.post!(checksum: "outdated") }
  end

  it "is only available at its step" do
    setting.update!(closing_method: :direct, retained_earnings_account: retained_earnings)
    start_closing!(fiscal_year, member: member)
    expect_closing_error(:wrong_step) { service.post!(checksum: service.plan.checksum) }
  end

  it "is deleted when going back from the beginning step" do
    to_ending!
    post!
    Accounting::Closing::Rollback.new(fiscal_year.reload).call
    expect(fiscal_year.reload.closing_step).to eq("ending")
    expect(fiscal_year.closing_entries.pluck(:entry_type)).to eq(%w[closing_temp_accounts])
    expect(fiscal_year.closing_data).not_to have_key("ending")
    expect(balances(bank)).to eq([ [ 110, 110 ] ])
  end
end
