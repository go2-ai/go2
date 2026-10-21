require "rails_helper"

RSpec.describe Accounting::Closing::BeginningEntry do
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

  def to_beginning!
    setting.update!(closing_method: :direct, retained_earnings_account: retained_earnings)
    start_closing!(fiscal_year, member: member)
    Accounting::Closing::RevaluationStep.new(fiscal_year.reload, member: member).complete!
    temp = Accounting::Closing::TempClosing.new(fiscal_year.reload, member: member)
    temp.post!(checksum: temp.plan.checksum)
    ending = Accounting::Closing::EndingEntry.new(fiscal_year.reload, member: member)
    ending.post!(checksum: ending.plan.checksum)
    fiscal_year.reload
  end

  def service
    described_class.new(fiscal_year.reload, member: member)
  end

  def balances(account, year)
    Accounting::Balances::Query.new(organization: organization, fiscal_year: year, account_ids: [ account.id ])
                               .call.map { |r| [ r.currency_id, r.base_balance, r.currency_balance ] }
  end

  def expect_blocked(*blockers)
    expect { service.post! }.to raise_error(Accounting::Closing::Error) do |e|
      expect(e.key).to eq(:beginning_blocked)
      expect(e.details[:blockers]).to include(*blockers)
    end
  end

  before do
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 3, 1), lines: [
      je_line(bank, debit: 110), je_line(revenue, credit: 110)
    ])
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 4, 1), lines: [
      je_line(inventory, debit: 55, currency: eur, rate: 1.1), je_line(bank, credit: 55)
    ])
  end

  it "carries the permanent balances into the next year and closes the year" do
    to_beginning!
    expect(service.plan).to be_postable
    service.post!

    entry = next_year.journal_entries.find_by!(entry_type: :beginning)
    expect(entry).to have_attributes(no: "1", date: Date.new(2025, 1, 1), state: "approved", source: fiscal_year)
    expect(balances(bank, next_year)).to eq([ [ usd.id, 55, 55 ] ])
    expect(balances(inventory, next_year)).to eq([ [ eur.id, 55, 50 ] ])
    expect(balances(retained_earnings, next_year)).to eq([ [ usd.id, -110, -110 ] ])

    expect(fiscal_year.reload).to have_attributes(status: "closed", closing_step: "finalized", closed_by: member)
    expect(fiscal_year.closed_at).to be_present
    expect(fiscal_year.closing_data.dig("beginning", "entry_id")).to eq(entry.id)

    bank_line = entry.items.find_by!(account: bank)
    expect(bank_line.currency_amount).to be_nil
    expect(bank_line.description).to eq("Opening balance of #{bank.full_code} Bank carried from fiscal year #{fiscal_year.name}")
    ending = fiscal_year.closing_entries.find_by!(entry_type: :ending)
    expect(ending.items.find_by!(account: inventory)).to have_attributes(currency_amount: 50,
                                                                        description: "Ending balance of #{inventory.full_code} Inventory, fiscal year #{fiscal_year.name}")
  end

  it "uses the closing's own line templates, then the organization default" do
    setting.update!(closing_line_description_templates: { "ending" => { "en" => "Org {account_name}" } })
    to_beginning!
    fiscal_year.update!(closing_data: fiscal_year.closing_data.merge(
      "line_templates" => { "beginning" => { "en" => "{account_name} {currency_amount} {currency} into {next_fiscal_year}" } }
    ))
    service.post!
    beginning = next_year.journal_entries.find_by!(entry_type: :beginning)
    expect(beginning.items.find_by!(account: inventory).description).to eq("Inventory 50.00 EUR into #{next_year.name}")
    expect(fiscal_year.closing_entries.find_by!(entry_type: :ending).items.find_by!(account: bank).description).to eq("Org Bank")
  end

  it "describes the entry in each language, with the fiscal year's name in that language" do
    organization.update!(active_locales: [ :fa ])
    fiscal_year.update!(name_en: "FY 2024", name_fa: "سال ۱۴۰۳")
    to_beginning!
    service.post!

    entry = next_year.journal_entries.find_by!(entry_type: :beginning)
    expect(entry.read_attribute(:description)).to eq(
      "en" => "Beginning entry carried from fiscal year FY 2024",
      "fa" => "سند افتتاحیه منتقل‌شده از سال مالی سال ۱۴۰۳"
    )
    line = entry.items.find_by!(account: bank).read_attribute(:description)
    expect(line["en"]).to end_with("carried from fiscal year FY 2024")
    expect(line["fa"]).to end_with("منتقل‌شده از سال مالی سال ۱۴۰۳")
  end

  it "takes another number when 1 is used" do
    post_entry(fiscal_year: next_year, date: Date.new(2025, 2, 1), no: "1",
               lines: [ je_line(bank, debit: 1), je_line(revenue, credit: 1) ])
    to_beginning!
    service.post!
    expect(next_year.journal_entries.find_by!(entry_type: :beginning).no).not_to eq("1")
  end

  it "protects the closed year and the beginning entry" do
    to_beginning!
    service.post!
    entry = Accounting::JournalEntry.find(next_year.journal_entries.find_by!(entry_type: :beginning).id)
    expect(entry.destroy).to be(false)
    closing = Accounting::JournalEntry.find(fiscal_year.closing_entries.find_by!(entry_type: :ending).id)
    closing.system_context = :fiscal_year_closing
    expect(closing.destroy).to be(false)
  end

  it "requires the next year to be open" do
    to_beginning!
    next_year.update_column(:status, FiscalYear.statuses[:closing])
    expect_blocked("next_fiscal_year_not_open")
  end

  it "refuses when the next year has beginning entries made by hand" do
    post_entry(fiscal_year: next_year, date: Date.new(2025, 1, 1), entry_type: :beginning,
               lines: [ je_line(bank, debit: 5), je_line(retained_earnings, credit: 5) ])
    to_beginning!
    expect(service.plan.manual_beginning_entries.size).to eq(1)
    expect_blocked("manual_beginning_entries")
  end

  it "refuses when the next year has permanent revaluations" do
    to_beginning!
    revaluation = Accounting::CurrencyRevaluation.create!(organization: organization, fiscal_year: next_year,
                                                          as_of_date: Date.new(2025, 3, 31), kind: :permanent,
                                                          scope: {}, created_by: member)
    revaluation.update_columns(status: Accounting::CurrencyRevaluation.statuses[:posted])
    expect_blocked("next_year_permanent_revaluations")
  end

  it "is only available at its step" do
    expect { service.post! }.to raise_error(Accounting::Closing::Error) { |e| expect(e.key).to eq(:wrong_step) }
  end
end
