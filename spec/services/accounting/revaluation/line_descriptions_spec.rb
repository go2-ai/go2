require "rails_helper"

RSpec.describe "Revaluation line descriptions and left-out combinations" do
  let(:organization) { create(:organization) }
  let(:setting) { organization.accounting_setting }
  let!(:usd) { setting.main_currency }
  let(:eur) { create(:accounting_currency, organization: organization, abr: "EUR") }
  let(:member) { create(:member, organization: organization, user: create(:user)) }
  let(:fiscal_year) do
    create(:fiscal_year, organization: organization,
           start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31))
  end
  let(:center_type) { create(:accounting_center_type, organization: organization, first_code: "000001", last_code: "000050") }
  let(:branch) { create(:accounting_center, center_type: center_type, code: "000001", name: { en: "Tehran" }) }
  let(:bank) { create_account_in(organization, "CA", ledger_code: "10", monetary: true, name: "Bank") }
  let(:payable) { create_account_in(organization, "CL", ledger_code: "10", monetary: true, name: "Payable") }
  let(:revenue) { create_account_in(organization, "RE", ledger_code: "10", name: "Sales") }
  let(:fx_gain) { create_account_in(organization, "RE", ledger_code: "90", name: "FX gain") }
  let(:other_gain) { create_account_in(organization, "RE", ledger_code: "91", name: "Other FX gain") }
  let(:fx_loss) { create_account_in(organization, "EX", ledger_code: "90", name: "FX loss") }
  let(:descriptions) { Accounting::Revaluation::LineDescriptions }

  def revaluation(kind: :temporary, **attrs)
    record = Accounting::CurrencyRevaluation.create!(organization: organization, fiscal_year: fiscal_year,
                                                     as_of_date: Date.new(2024, 6, 30), kind: kind, scope: {},
                                                     created_by: member, **attrs)
    Accounting::Revaluation::Preparer.new(record).call
    record.reload
  end

  def post!(record)
    Accounting::Revaluation::Poster.new(record, member: member).call
  end

  def item_for(record, account)
    record.items.find { |item| item.account_id == account.id }
  end

  before do
    bank.update!(allowed_center_types_1: [ center_type.id ])
    setting.update!(default_fx_gain_account: fx_gain, default_fx_loss_account: fx_loss)
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 3, 1), lines: [
      je_line(bank, debit: 1100, currency: eur, rate: 1.1, centers: { 1 => branch }), je_line(revenue, credit: 1100)
    ])
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 3, 2), lines: [
      je_line(revenue, debit: 50), je_line(payable, credit: 50, currency: eur, rate: 1)
    ])
    create(:accounting_exchange_rate, organization: organization, currency: eur, date: Date.new(2024, 6, 30), rate: "1.25")
  end

  describe "template validation" do
    it "accepts known variables and blank templates" do
      expect(descriptions.problems("{account_name} {center1_name} at {rate}", "item")).to be_empty
      expect(descriptions.problems("", "item")).to be_empty
    end

    it "reports unknown variables, unmatched braces and length" do
      expect(descriptions.problems("Gain {rate}", "counter").map(&:first)).to eq([ :template_unknown_variables ])
      expect(descriptions.problems("Gain {as_of_date", "counter").map(&:first)).to eq([ :template_unbalanced_braces ])
      expect(descriptions.problems("x" * 301, "item").map(&:first)).to eq([ :template_too_long ])
    end

    it "validates revaluations and settings" do
      record = Accounting::CurrencyRevaluation.new(line_description_template: { "en" => "{nope}" })
      record.valid?
      expect(record.errors[:line_description_template].join).to include("{nope}")

      expect(setting.update(revaluation_counter_line_description_template: { "en" => "{rate}" })).to be(false)
    end
  end

  describe "posted entry" do
    it "describes every line with the built-in templates" do
      entry = post!(revaluation).journal_entry
      bank_line = entry.items.find_by!(account: bank)
      expect(bank_line.description).to eq("Revaluation of #{bank.full_code} Bank: 1,000.00 EUR at 1.25 as of 2024-06-30")
      gain_line = entry.items.find_by!(account: fx_gain)
      expect(gain_line.description).to eq("Revaluation gain/loss of foreign currency monetary items as of 2024-06-30")
    end

    it "uses the organization default, then the revaluation's own template" do
      setting.update!(revaluation_line_description_template: { "en" => "Org {currency}" },
                      revaluation_counter_line_description_template: { "en" => "Result on {account_name}" })
      entry = post!(revaluation(line_description_template: { "en" => "{account_name} / {center1_code} {center1_name}" }))
              .journal_entry
      expect(entry.items.find_by!(account: bank).description).to eq("Bank / 000001 Tehran")
      expect(entry.items.find_by!(account: payable).description).to eq("Payable /")
      expect(entry.items.find_by!(account: fx_gain).description).to eq("Result on FX gain")
    end

    it "describes items and counter lines per locale" do
      record = revaluation(line_description_template: { "en" => "{account_name} {difference}" })
      item = item_for(record, bank)
      texts = descriptions.new(record)

      expect(texts.item(item)).to eq("en" => "Bank 150.00")
      expect(texts.counter(fx_gain.id, Array.new(6), item.difference))
        .to eq("en" => "Revaluation gain/loss of foreign currency monetary items as of 2024-06-30")
    end
  end

  describe "left-out combinations" do
    def leave_out!(record, account)
      item = item_for(record, account)
      item.update!(removed: true)
      record.update!(removed_keys: [ item.key ])
      record
    end

    it "are not posted and stay out when the preview is rebuilt" do
      record = leave_out!(revaluation, bank)
      Accounting::Revaluation::Preparer.new(record.reload).call
      expect(item_for(record.reload, bank)).to be_removed
      entry = post!(record).journal_entry
      expect(entry.items.pluck(:account_id)).not_to include(bank.id)
      expect(record.reload.postable_items.map(&:account_id)).to eq([ payable.id ])
    end

    it "are not locked by a permanent revaluation" do
      record = post!(leave_out!(revaluation(kind: :permanent), bank))
      locks = Accounting::Revaluation::PermanentLocks.new(organization)
      bank_item = item_for(record, bank)
      expect(locks.blocking(account_id: bank.id, currency_id: eur.id, center_ids: bank_item.center_ids,
                            date: Date.new(2024, 5, 1))).to be_nil
      expect(locks.blocking(account_id: payable.id, currency_id: eur.id, center_ids: [ nil ] * 6,
                            date: Date.new(2024, 5, 1))).to eq(record)
    end
  end

  it "keeps a changed gain/loss account when the preview is rebuilt" do
    record = revaluation
    item_for(record, bank).update!(gain_loss_account: other_gain)
    Accounting::Revaluation::Preparer.new(record.reload).call
    expect(item_for(record.reload, bank).gain_loss_account_id).to eq(other_gain.id)
  end
end
