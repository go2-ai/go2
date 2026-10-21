require "rails_helper"

RSpec.describe Accounting::Closing::Renumberer do
  let(:organization) { create(:organization) }
  let(:member) { create(:member, organization: organization, user: create(:user)) }
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

  def entry!(date, **attrs)
    post_entry(fiscal_year: fiscal_year, date: date, lines: [ je_line(bank, debit: 10), je_line(revenue, credit: 10) ], **attrs)
  end

  def service
    described_class.new(fiscal_year.reload, member: member)
  end

  before { organization.accounting_setting.update!(retained_earnings_account: retained_earnings) }

  it "numbers the entries by date, then beginning first, then creation" do
    march = entry!(Date.new(2024, 3, 1), no: "50")
    january = entry!(Date.new(2024, 1, 10), no: "7")
    # A beginning entry made by hand on the first day, created after another entry of that day.
    first_day = entry!(Date.new(2024, 1, 1), no: "3")
    beginning = post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 1, 1), entry_type: :beginning, no: "9",
                           lines: [ je_line(bank, debit: 5), je_line(retained_earnings, credit: 5) ])
    refs = [ march, january, first_day, beginning ].map { |e| e.reload.ref }
    Accounting::Closing::Starter.new(fiscal_year, member: member).call

    plan = service.plan
    expect(plan.entries_count).to eq(4)
    expect(plan.changes.map { |c| [ c.id, c.no, c.new_no ] }).to contain_exactly(
      [ beginning.id, "9", "1" ], [ first_day.id, "3", "2" ], [ january.id, "7", "3" ], [ march.id, "50", "4" ]
    )

    # Other specs toggle versioning globally; the change log needs it here.
    versioning = PaperTrail.enabled?
    begin
      PaperTrail.enabled = true
      service.renumber!
    ensure
      PaperTrail.enabled = versioning
    end
    expect([ beginning, first_day, january, march ].map { |e| e.reload.no }).to eq(%w[1 2 3 4])
    expect([ march, january, first_day, beginning ].map(&:ref)).to eq(refs)
    expect(fiscal_year.reload.closing_step).to eq("revaluation")
    expect(fiscal_year.closing_data["renumber"]).to include("renumbered" => 4)
    expect(march.versions.last.changeset["no"]).to eq(%w[50 4])
  end

  it "can be skipped" do
    entry!(Date.new(2024, 3, 1), no: "50")
    Accounting::Closing::Starter.new(fiscal_year, member: member).call
    service.skip!
    expect(fiscal_year.reload.closing_step).to eq("revaluation")
    expect(fiscal_year.journal_entries.sole.no).to eq("50")
  end

  it "is only available at its step, and the closing can go back to it" do
    expect { service.skip! }.to raise_error(Accounting::Closing::Error) { |e| expect(e.key).to eq(:wrong_step) }
    Accounting::Closing::Starter.new(fiscal_year, member: member).call
    service.skip!
    Accounting::Closing::Rollback.new(fiscal_year.reload).call
    expect(fiscal_year.reload).to have_attributes(closing_step: "renumber")
    expect(fiscal_year.closing_data).not_to have_key("renumber")
  end
end
