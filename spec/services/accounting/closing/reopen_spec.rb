require "rails_helper"

RSpec.describe "Fiscal year closing: reopen and rollback" do
  let(:organization) { create(:organization) }
  let(:setting) { organization.accounting_setting }
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
  let(:revenue) { create_account_in(organization, "RE", ledger_code: "10", name: "Sales") }
  let(:retained_earnings) { create_account_in(organization, "OE", ledger_code: "30", name: "Retained earnings") }

  def close_year!(until_step: :finalized)
    setting.update!(closing_method: :direct, retained_earnings_account: retained_earnings)
    start_closing!(fiscal_year, member: member)
    Accounting::Closing::RevaluationStep.new(fiscal_year.reload, member: member).complete!
    return if until_step == :temp_closing

    temp = Accounting::Closing::TempClosing.new(fiscal_year.reload, member: member)
    temp.post!(checksum: temp.plan.checksum)
    return if until_step == :ending

    ending = Accounting::Closing::EndingEntry.new(fiscal_year.reload, member: member)
    ending.post!(checksum: ending.plan.checksum)
    return if until_step == :beginning

    Accounting::Closing::BeginningEntry.new(fiscal_year.reload, member: member).post!
  end

  def rollback!
    Accounting::Closing::Rollback.new(fiscal_year.reload).call
  end

  def next_year_balance(account)
    Accounting::Balances::Query.new(organization: organization, fiscal_year: next_year, account_ids: [ account.id ])
                               .call.sum(BigDecimal("0"), &:base_balance)
  end

  def expect_closing_error(key)
    expect { yield }.to raise_error(Accounting::Closing::Error) { |e| expect(e.key).to eq(key) }
  end

  before do
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 3, 1), lines: [
      je_line(bank, debit: 110), je_line(revenue, credit: 110)
    ])
  end

  describe "reopening a closed year" do
    before { close_year! }

    it "deletes the beginning entry and goes back to the beginning step" do
      expect(next_year_balance(bank)).to eq(110)
      rollback!
      expect(fiscal_year.reload).to have_attributes(status: "closing", closing_step: "beginning", closed_at: nil, closed_by: nil)
      expect(fiscal_year.closing_data).not_to have_key("beginning")
      expect(next_year.journal_entries.where(entry_type: :beginning)).to be_empty
      expect(next_year_balance(bank)).to eq(0)
      expect(fiscal_year.closing_entries.pluck(:entry_type)).to contain_exactly("closing_temp_accounts", "ending")
    end

    it "can be closed again" do
      rollback!
      Accounting::Closing::BeginningEntry.new(fiscal_year.reload, member: member).post!
      expect(fiscal_year.reload).to be_closed
      expect(next_year_balance(bank)).to eq(110)
    end

    it "requires the next year to be open" do
      next_year.update_column(:status, FiscalYear.statuses[:closing])
      expect { rollback! }.to raise_error(Accounting::Closing::Error) do |e|
        expect(e.key).to eq(:reopen_blocked)
        expect(e.details[:blockers]).to eq([ "next_fiscal_year_not_open" ])
      end
      expect(fiscal_year.reload).to be_closed
    end

    it "refuses while the next year has permanent revaluations" do
      revaluation = Accounting::CurrencyRevaluation.create!(organization: organization, fiscal_year: next_year,
                                                            as_of_date: Date.new(2025, 3, 31), kind: :permanent,
                                                            scope: {}, created_by: member)
      revaluation.update_columns(status: Accounting::CurrencyRevaluation.statuses[:posted])
      expect_closing_error(:reopen_blocked) { rollback! }
    end
  end

  describe "step by step" do
    it "undoes the steps in reverse order" do
      close_year!
      rollback!
      expect(fiscal_year.reload.closing_step).to eq("beginning")
      rollback!
      expect(fiscal_year.reload.closing_step).to eq("ending")
      expect(fiscal_year.closing_entries.pluck(:entry_type)).to eq(%w[closing_temp_accounts])
      rollback!
      expect(fiscal_year.reload.closing_step).to eq("temp_closing")
      expect(fiscal_year.closing_entries).to be_empty
      rollback!
      expect(fiscal_year.reload.closing_step).to eq("revaluation")
      rollback!
      expect(fiscal_year.reload.closing_step).to eq("renumber")
      expect_closing_error(:wrong_step) { rollback! }
    end

    it "refuses for an open year" do
      expect_closing_error(:not_closing) { rollback! }
    end
  end

  describe ".reopen_fully!" do
    it "reopens a closed year completely" do
      close_year!
      Accounting::Closing::Rollback.reopen_fully!(fiscal_year.reload)
      expect(fiscal_year.reload).to have_attributes(status: "open", closing_step: nil, closing_data: {}, closed_at: nil)
      expect(fiscal_year.closing_entries).to be_empty
      expect(next_year.journal_entries).to be_empty
    end

    it "works from a middle step" do
      close_year!(until_step: :ending)
      Accounting::Closing::Rollback.reopen_fully!(fiscal_year.reload)
      expect(fiscal_year.reload).to be_open
      expect(fiscal_year.closing_entries).to be_empty
    end

    it "changes nothing when a step can't be undone" do
      close_year!
      next_year.update_column(:status, FiscalYear.statuses[:closing])
      expect_closing_error(:reopen_blocked) { Accounting::Closing::Rollback.reopen_fully!(fiscal_year.reload) }
      expect(fiscal_year.reload).to be_closed
      expect(fiscal_year.closing_entries.count).to eq(3)
    end

    it "lets the user change entries again" do
      close_year!
      Accounting::Closing::Rollback.reopen_fully!(fiscal_year.reload)
      entry = Accounting::JournalEntry.find(fiscal_year.journal_entries.sole.id)
      entry.description = "Changed"
      expect(entry.lock_reason).to be_nil
    end
  end
end
