require "rails_helper"

RSpec.describe "Fiscal year closing: revaluation step" do
  let(:organization) { create(:organization) }
  let!(:usd) { organization.accounting_setting.main_currency }
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
  let(:revenue) { create_account_in(organization, "RE", ledger_code: "10", name: "Sales") }
  let(:fx_gain) { create_account_in(organization, "RE", ledger_code: "90", name: "FX gain") }
  let(:fx_loss) { create_account_in(organization, "EX", ledger_code: "90", name: "FX loss") }
  let(:retained_earnings) { create_account_in(organization, "OE", ledger_code: "30", name: "Retained earnings") }

  def rate!(date, rate)
    create(:accounting_exchange_rate, organization: organization, currency: eur, date: date, rate: rate)
  end

  def posted_revaluation!(as_of, kind:)
    record = Accounting::CurrencyRevaluation.create!(organization: organization, fiscal_year: fiscal_year,
                                                     as_of_date: as_of, kind: kind, scope: {}, created_by: member)
    Accounting::Revaluation::Preparer.new(record).call
    Accounting::Revaluation::Poster.new(record.reload, member: member).call
  end

  def check
    Accounting::Closing::RevaluationCheck.new(fiscal_year.reload).call
  end

  def step
    Accounting::Closing::RevaluationStep.new(fiscal_year.reload, member: member)
  end

  def expect_closing_error(key)
    expect { yield }.to raise_error(Accounting::Closing::Error) { |e| expect(e.key).to eq(key) }
  end

  before do
    organization.accounting_setting.update!(default_fx_gain_account: fx_gain, default_fx_loss_account: fx_loss,
                                            retained_earnings_account: retained_earnings)
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 3, 1), lines: [
      je_line(bank, debit: 110, currency: eur, rate: 1.1), je_line(revenue, credit: 110)
    ])
  end

  describe Accounting::Closing::RevaluationCheck do
    it "lists balances that a year-end permanent revaluation would still change" do
      rate!(Date.new(2024, 12, 31), "1.2")
      result = check
      expect(result.unrevalued.size).to eq(1)
      expect(result.unrevalued.first).to include(account_id: bank.id, currency_id: eur.id, difference: BigDecimal("10"))
      expect(result.total_difference).to eq(BigDecimal("10"))
      expect(result).not_to be_passes
    end

    it "lists balances without a rate" do
      result = check
      expect(result.missing_rates.map { |item| item[:account_id] }).to eq([ bank.id ])
      expect(result).not_to be_clean
    end

    it "passes after a permanent revaluation as of the last day" do
      rate!(Date.new(2024, 12, 31), "1.2")
      posted_revaluation!(Date.new(2024, 12, 31), kind: :permanent)
      expect(check).to be_passes
    end

    it "passes when the balance is already at the year-end rate" do
      rate!(Date.new(2024, 12, 31), "1.1")
      expect(check).to have_attributes(unrevalued: [], missing_rates: [])
      expect(check).to be_passes
    end

    it "blocks while temporary revaluations remain, even when acknowledged" do
      rate!(Date.new(2024, 6, 30), "1.2")
      rate!(Date.new(2024, 12, 31), "1.1")
      temporary = posted_revaluation!(Date.new(2024, 6, 30), kind: :temporary)
      result = check
      expect(result.temporaries).to eq([ temporary ])
      expect(result).to be_clean
      expect(result).not_to be_passes
    end
  end

  describe Accounting::Closing::RevaluationStep do
    before { rate!(Date.new(2024, 12, 31), "1.2") }

    it "only works at the revaluation step" do
      expect_closing_error(:wrong_step) { step.acknowledge! }
      expect_closing_error(:wrong_step) { step.complete! }
    end

    context "when closing" do
      before { start_closing!(fiscal_year, member: member) }

      it "refuses to continue while differences remain" do
        expect_closing_error(:revaluation_incomplete) { step.complete! }
      end

      it "continues once the remaining differences are acknowledged" do
        step.acknowledge!
        data = fiscal_year.reload.closing_data["revaluation_acknowledgment"]
        expect(data).to include("member_id" => member.id, "total_difference" => "10.0", "missing_rates" => 0)
        expect(check.acknowledged).to be(true)

        step.complete!
        expect(fiscal_year.reload).to have_attributes(closing_step: "temp_closing", status: "closing")
      end

      it "drops the acknowledgment when rates change" do
        step.acknowledge!
        Accounting::ExchangeRate.find_by!(currency: eur, date: Date.new(2024, 12, 31)).update!(rate: "1.25")
        expect(check.acknowledged).to be(false)
        expect_closing_error(:revaluation_incomplete) { step.complete! }
      end

      it "continues after revaluing as of the year end" do
        posted_revaluation!(Date.new(2024, 12, 31), kind: :permanent)
        step.complete!
        expect(fiscal_year.reload.closing_step).to eq("temp_closing")
      end

      it "can't acknowledge temporary revaluations" do
        posted_revaluation!(Date.new(2024, 12, 31), kind: :temporary)
        expect_closing_error(:temporary_revaluations_remain) { step.acknowledge! }
        expect_closing_error(:temporary_revaluations_remain) { step.complete! }
      end

      it "allows making the remaining temporary revaluation permanent" do
        temporary = posted_revaluation!(Date.new(2024, 12, 31), kind: :temporary)
        Accounting::Revaluation::KindToggler.new(temporary, kind: :permanent).call
        step.complete!
        expect(fiscal_year.reload.closing_step).to eq("temp_closing")
      end

      it "freezes revaluations after the step" do
        revaluation = posted_revaluation!(Date.new(2024, 12, 31), kind: :permanent)
        step.complete!

        error = Accounting::Revaluation::Builder::Error
        expect { Accounting::Revaluation::Remover.new(revaluation.reload).call }
          .to raise_error(error) { |e| expect(e.key).to eq(:fiscal_year_closing) }
        expect { Accounting::Revaluation::KindToggler.new(revaluation.reload, kind: :temporary).call }
          .to raise_error(error) { |e| expect(e.key).to eq(:fiscal_year_closing) }
        expect { posted_revaluation!(Date.new(2024, 12, 31), kind: :permanent) }
          .to raise_error(error) { |e| expect(e.key).to eq(:fiscal_year_closing) }
      end
    end
  end
end
