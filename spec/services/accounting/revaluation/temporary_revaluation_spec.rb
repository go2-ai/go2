require "rails_helper"

RSpec.describe "Temporary currency revaluation" do
  let(:organization) { create(:organization) }
  let!(:usd) { organization.accounting_setting.main_currency }
  let(:eur) { create(:accounting_currency, organization: organization, abr: "EUR") }
  let(:member) { create(:member, organization: organization, user: create(:user)) }
  let(:fiscal_year) do
    create(:fiscal_year, organization: organization,
           start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31))
  end

  let(:bank) { create_account_in(organization, "CA", ledger_code: "10", monetary: true, name: "Bank") }
  let(:inventory) { create_account_in(organization, "CA", ledger_code: "20", name: "Inventory") }
  let(:payable) { create_account_in(organization, "CL", ledger_code: "10", monetary: true, name: "Payable") }
  let(:revenue) { create_account_in(organization, "RE", ledger_code: "10", name: "Sales") }
  let(:fx_gain) { create_account_in(organization, "RE", ledger_code: "90", name: "FX gain") }
  let(:fx_loss) { create_account_in(organization, "EX", ledger_code: "90", name: "FX loss") }

  def rate!(date, rate)
    create(:accounting_exchange_rate, organization: organization, currency: eur, date: date, rate: rate)
  end

  def new_revaluation(as_of, scope = {})
    revaluation = Accounting::CurrencyRevaluation.create!(
      organization: organization, fiscal_year: fiscal_year, as_of_date: as_of, scope: scope, created_by: member
    )
    Accounting::Revaluation::Preparer.new(revaluation).call
    revaluation.reload
  end

  def post!(revaluation)
    Accounting::Revaluation::Poster.new(revaluation, member: member).call
  end

  def item_for(revaluation, account)
    revaluation.items.find { |item| item.account_id == account.id }
  end

  def balance(account, currency = eur)
    Accounting::Balances::Query.new(organization: organization, fiscal_year: fiscal_year, account_ids: [ account.id ])
                               .call.find { |row| row.currency_id == currency.id }
  end

  before do
    organization.accounting_setting.update!(default_fx_gain_account: fx_gain, default_fx_loss_account: fx_loss)
    # 100 EUR received at 1.1 (book 110 USD).
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 3, 1), lines: [
      je_line(bank, debit: 110, currency: eur, rate: 1.1),
      je_line(revenue, credit: 110)
    ])
    # 50 EUR owed at 1.0 (book 50 USD).
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 4, 1), lines: [
      je_line(inventory, debit: 50),
      je_line(payable, credit: 50, currency: eur, rate: 1)
    ])
    rate!(Date.new(2024, 6, 28), "1.25")
  end

  describe "preview" do
    it "computes revalued balances and differences for asset and liability balances" do
      revaluation = new_revaluation(Date.new(2024, 6, 30))

      bank_item = item_for(revaluation, bank)
      expect(bank_item.currency_balance).to eq(100)
      expect(bank_item.book_base_balance).to eq(110)
      expect(bank_item.rate).to eq(BigDecimal("1.25"))
      expect(bank_item.rate_date).to eq(Date.new(2024, 6, 28))
      expect(bank_item.revalued_base_balance).to eq(125)
      expect(bank_item.difference).to eq(15)
      expect(bank_item.gain_loss_account_id).to eq(fx_gain.id)

      payable_item = item_for(revaluation, payable)
      expect(payable_item.currency_balance).to eq(-50)
      expect(payable_item.difference).to eq(BigDecimal("-12.5"))
      expect(payable_item.gain_loss_account_id).to eq(fx_loss.id)
      expect(revaluation.checksum).to be_present
    end

    it "only covers monetary accounts in foreign currencies" do
      revaluation = new_revaluation(Date.new(2024, 6, 30))
      expect(revaluation.items.map(&:account_id)).to contain_exactly(bank.id, payable.id)
    end

    it "rounds to the main currency's decimal digits" do
      rate!(Date.new(2024, 6, 29), "1.23456")
      expect(item_for(new_revaluation(Date.new(2024, 6, 30)), bank).difference).to eq(BigDecimal("13.46"))
    end

    it "limits to the scope" do
      revaluation = new_revaluation(Date.new(2024, 6, 30), { "account_ids" => [ payable.id ] })
      expect(revaluation.items.map(&:account_id)).to eq([ payable.id ])
    end

    it "excludes items without a rate" do
      revaluation = new_revaluation(Date.new(2024, 6, 1))
      expect(revaluation.items).to all(have_attributes(excluded: true, excluded_reason: "missing_rate"))
    end

    it "excludes items without an FX gain/loss account" do
      organization.accounting_setting.update!(default_fx_gain_account: nil)
      bank_item = item_for(new_revaluation(Date.new(2024, 6, 30)), bank)
      expect(bank_item).to have_attributes(excluded: true, excluded_reason: "missing_fx_account")
    end

    it "excludes items whose gain/loss account requires a center they don't have" do
      center_type = create(:accounting_center_type, organization: organization, first_code: "000001", last_code: "000050")
      fx_gain.update!(allowed_center_types_1: [ center_type.id ])
      bank_item = item_for(new_revaluation(Date.new(2024, 6, 30)), bank)
      expect(bank_item).to have_attributes(excluded: true, excluded_reason: "center_mismatch")
    end

    it "refuses closed fiscal years" do
      fiscal_year.update_column(:status, FiscalYear.statuses[:closed])
      revaluation = Accounting::CurrencyRevaluation.create!(organization: organization, fiscal_year: fiscal_year,
                                                            as_of_date: Date.new(2024, 6, 30))
      expect { Accounting::Revaluation::Preparer.new(revaluation).call }
        .to raise_error(Accounting::Revaluation::Builder::Error) { |e| expect(e.key).to eq(:fiscal_year_closed) }
    end
  end

  describe "posting" do
    it "creates an approved revaluation entry linked to the revaluation" do
      revaluation = post!(new_revaluation(Date.new(2024, 6, 30)))

      entry = revaluation.journal_entry
      expect(revaluation).to be_posted
      expect(entry).to have_attributes(entry_type: "revaluation", state: "approved", date: Date.new(2024, 6, 30),
                                       approved_by_id: member.id, debit: BigDecimal("27.5"), credit: BigDecimal("27.5"))

      lines = entry.items.map { |i| [ i.account_id, i.currency_id, i.debit, i.credit, i.currency_amount ] }
      expect(lines).to contain_exactly(
        [ bank.id, eur.id, 15, 0, 0 ],
        [ payable.id, eur.id, 0, BigDecimal("12.5"), 0 ],
        [ fx_gain.id, usd.id, 0, 15, nil ],
        [ fx_loss.id, usd.id, BigDecimal("12.5"), 0, nil ]
      )
      # Only the main-currency amount changes: no rate on any line.
      expect(entry.items.reload.map(&:rate)).to all(be_nil)

      # Book value now matches the revalued balance; the foreign balance is unchanged.
      expect(balance(bank)).to have_attributes(base_balance: 125, currency_balance: 100)
      expect(balance(payable)).to have_attributes(base_balance: BigDecimal("-62.5"), currency_balance: -50)
    end

    it "nets differences per gain/loss account and keeps the centers it allows" do
      center_type = create(:accounting_center_type, organization: organization, first_code: "000001", last_code: "000050")
      branch = create(:accounting_center, center_type: center_type, code: "000001")
      post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 5, 1), lines: [
        je_line(bank, debit: 220, currency: eur, rate: 1.1, centers: { 1 => branch }),
        je_line(revenue, credit: 220)
      ])
      single_fx = create_account_in(organization, "RE", ledger_code: "91", name: "FX result")
      single_fx.update!(allowed_center_types_1: [ center_type.id ])
      organization.accounting_setting.update!(default_fx_gain_account: single_fx, default_fx_loss_account: single_fx)

      revaluation = new_revaluation(Date.new(2024, 6, 30), { "center_ids" => [ branch.id ] })
      entry = post!(revaluation).journal_entry

      fx_lines = entry.items.select { |i| i.account_id == single_fx.id }
      expect(fx_lines.map { |i| [ i.center1_id, i.credit ] }).to eq([ [ branch.id, 30 ] ])
    end

    it "refuses to post when balances changed since the preview" do
      revaluation = new_revaluation(Date.new(2024, 6, 30))
      post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 6, 1), lines: [
        je_line(bank, debit: 11, currency: eur, rate: 1.1), je_line(revenue, credit: 11)
      ])

      expect { post!(revaluation) }
        .to raise_error(Accounting::Revaluation::Builder::Error) { |e| expect(e.key).to eq(:stale) }
      expect(revaluation.reload).to be_draft
    end

    it "refuses to post when there is nothing to post" do
      revaluation = new_revaluation(Date.new(2024, 6, 1)) # no rates yet
      expect { post!(revaluation) }
        .to raise_error(Accounting::Revaluation::Builder::Error) { |e| expect(e.key).to eq(:nothing_to_post) }
    end

    it "protects the generated entry from manual changes" do
      entry = post!(new_revaluation(Date.new(2024, 6, 30))).journal_entry
      loaded = Accounting::JournalEntry.find(entry.id)
      expect(loaded.destroy).to be(false)
      expect(loaded.lock_reason).to include("generated by the system")
    end
  end

  describe "superseding" do
    it "replaces an overlapping temporary revaluation and recomputes from book balances" do
      first = post!(new_revaluation(Date.new(2024, 6, 30)))
      rate!(Date.new(2024, 7, 31), "1.2")

      second = new_revaluation(Date.new(2024, 7, 31))
      # Computed without the first revaluation's entry.
      expect(item_for(second, bank).book_base_balance).to eq(110)
      expect(item_for(second, bank).difference).to eq(10)

      post!(second)
      expect(first.reload).to be_superseded
      expect(first.journal_entry).to be_nil
      expect(balance(bank).base_balance).to eq(120)
    end

    it "recomputes combinations the superseded revaluation covered outside the new scope" do
      post!(new_revaluation(Date.new(2024, 6, 30)))
      rate!(Date.new(2024, 7, 31), "1.2")

      second = new_revaluation(Date.new(2024, 7, 31), { "account_ids" => [ bank.id ] })
      expect(second.items.map(&:account_id)).to contain_exactly(bank.id, payable.id)

      post!(second)
      expect(balance(payable).base_balance).to eq(-60)
    end

    it "keeps temporary revaluations that don't overlap" do
      first = post!(new_revaluation(Date.new(2024, 6, 30), { "account_ids" => [ payable.id ] }))
      post!(new_revaluation(Date.new(2024, 6, 30), { "account_ids" => [ bank.id ] }))

      expect(first.reload).to be_posted
      expect(balance(payable).base_balance).to eq(BigDecimal("-62.5"))
      expect(balance(bank).base_balance).to eq(125)
    end
  end

  describe "removing" do
    it "deletes a posted temporary revaluation with its entry" do
      revaluation = post!(new_revaluation(Date.new(2024, 6, 30)))
      entry_id = revaluation.journal_entry.id

      Accounting::Revaluation::Remover.new(revaluation).call
      expect(Accounting::CurrencyRevaluation.exists?(revaluation.id)).to be(false)
      expect(Accounting::JournalEntry.exists?(entry_id)).to be(false)
      expect(balance(bank).base_balance).to eq(110)
    end
  end
end
