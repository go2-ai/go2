require "rails_helper"

RSpec.describe "Fiscal year closing: readiness, start and cancel" do
  let(:organization) { create(:organization) }
  let(:member) { create(:member, organization: organization, user: create(:user)) }
  let(:setting) { organization.accounting_setting }
  let!(:fiscal_year) do
    create(:fiscal_year, organization: organization,
           start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31))
  end
  let!(:next_year) do
    create(:fiscal_year, organization: organization,
           start_date: Date.new(2025, 1, 1), finish_date: Date.new(2025, 12, 31))
  end
  let(:bank) { create_account_in(organization, "CA", ledger_code: "10", monetary: true) }
  let(:revenue) { create_account_in(organization, "RE", ledger_code: "10") }
  let(:retained_earnings) { create_account_in(organization, "OE", ledger_code: "30") }

  def entry!(state, date: Date.new(2024, 3, 1), fy: fiscal_year)
    post_entry(fiscal_year: fy, date: date, state: state, lines: [ je_line(bank, debit: 10), je_line(revenue, credit: 10) ])
  end

  def readiness
    Accounting::Closing::Readiness.new(fiscal_year.reload).call
  end

  before { setting.update!(retained_earnings_account: retained_earnings) }

  describe Accounting::Closing::Readiness do
    it "is ready when everything is approved and the next year exists" do
      entry!(:approved)
      result = readiness
      expect(result).to be_ready
      expect(result.approved_count).to eq(1)
      expect(result.next_fiscal_year).to eq(next_year)
    end

    it "counts drafts and booked entries" do
      entry!(:draft)
      entry!(:booked)

      result = readiness
      expect(result.blockers).to contain_exactly(:drafts, :unapproved_entries)
      expect(result.drafts_count).to eq(1)
      expect(result.booked_count).to eq(1)
    end

    it "requires the next fiscal year" do
      next_year.destroy!
      expect(readiness.blockers).to include(:no_next_fiscal_year)
    end

    it "requires the closing accounts of the configured method" do
      setting.update!(closing_method: :income_summary)
      result = readiness
      expect(result.blockers).to include(:settings_incomplete)
      expect(result.settings_errors.join).to include("Income summary account")
    end

    it "requires the previous year to be closed when it has entries" do
      previous = create(:fiscal_year, organization: organization,
                        start_date: Date.new(2023, 1, 1), finish_date: Date.new(2023, 12, 31))
      expect(readiness).to be_ready

      entry!(:approved, date: Date.new(2023, 5, 1), fy: previous)
      expect(readiness.blockers).to include(:previous_fiscal_year_open)

      previous.update_column(:status, FiscalYear.statuses[:closed])
      expect(readiness).to be_ready
    end
  end

  describe Accounting::Closing::ApproveAll do
    it "approves booked entries and reports the ones that fail" do
      ok = entry!(:booked)
      broken = entry!(:booked)
      broken.items.first.update_column(:debit, 99) # unbalanced

      result = described_class.new(fiscal_year, member: member).call
      expect(result.approved).to eq(1)
      expect(result.failed.map { |f| f[:id] }).to eq([ broken.id ])
      expect(ok.reload).to be_approved
      expect(ok.approved_by).to eq(member)
      expect(broken.reload).to be_booked
    end
  end

  describe Accounting::Closing::Starter do
    it "starts closing: locks the year and snapshots the settings" do
      travel_to Time.utc(2025, 1, 5, 9) do
        described_class.new(fiscal_year, member: member).call
      end

      fiscal_year.reload
      expect(fiscal_year).to be_closing
      expect(fiscal_year.closing_step).to eq("renumber")
      expect(fiscal_year.closing_started_by).to eq(member)
      expect(fiscal_year.closing_data["settings"]).to include("closing_method" => "direct",
                                                              "retained_earnings_account_id" => retained_earnings.id)
      expect(fiscal_year.closing_data["next_fiscal_year_id"]).to eq(next_year.id)

      expect { entry!(:approved) }.to raise_error(ActiveRecord::RecordInvalid, /being closed/)
    end

    it "refuses to start when not ready" do
      entry!(:draft)
      expect { described_class.new(fiscal_year, member: member).call }
        .to raise_error(Accounting::Closing::Error) { |e| expect(e.details[:blockers]).to eq([ :drafts ]) }
      expect(fiscal_year.reload).to be_open
    end
  end

  describe Accounting::Closing::Canceler do
    it "reopens the year when nothing was posted" do
      Accounting::Closing::Starter.new(fiscal_year, member: member).call
      described_class.new(fiscal_year.reload).call

      expect(fiscal_year.reload).to have_attributes(status: "open", closing_step: nil, closing_data: {})
    end

    it "refuses once closing entries exist" do
      Accounting::Closing::Starter.new(fiscal_year, member: member).call
      post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 12, 31), entry_type: :closing_temp_accounts,
                 source: fiscal_year, system_context: :fiscal_year_closing,
                 lines: [ je_line(revenue, debit: 10), je_line(retained_earnings, credit: 10) ])

      expect { described_class.new(fiscal_year.reload).call }
        .to raise_error(Accounting::Closing::Error) { |e| expect(e.key).to eq(:roll_back_first) }
    end
  end
end
