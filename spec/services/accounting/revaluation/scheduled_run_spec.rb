require "rails_helper"

RSpec.describe "Scheduled currency revaluation" do
  include ActiveJob::TestHelper

  let(:organization) { create(:organization, time_zone: "Asia/Tehran") }
  let(:eur) { create(:accounting_currency, organization: organization, abr: "EUR") }
  let(:member) { create(:member, organization: organization, user: create(:user)) }
  let(:fiscal_year) do
    create(:fiscal_year, organization: organization,
           start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31))
  end
  let(:bank) { create_account_in(organization, "CA", ledger_code: "10", monetary: true, name: "Bank") }
  let(:revenue) { create_account_in(organization, "RE", ledger_code: "10", name: "Sales") }
  let(:fx_gain) { create_account_in(organization, "RE", ledger_code: "90", name: "FX gain") }
  let(:fx_loss) { create_account_in(organization, "EX", ledger_code: "90", name: "FX loss") }
  let(:tehran) { ActiveSupport::TimeZone["Asia/Tehran"] }

  def schedule!(rrule: "FREQ=DAILY", kind: :temporary, on_unapproved: :partial, dtstart: tehran.local(2024, 1, 1, 23, 0))
    Accounting::CurrencyRevaluationSchedule.create!(
      organization: organization, name: "Daily", rrule: rrule, dtstart: dtstart,
      default_kind: kind, on_unapproved: on_unapproved, created_by: member
    )
  end

  def run(schedule, at)
    Accounting::Revaluation::ScheduledRun.new(schedule, scheduled_for: at).call
  end

  def bank_balance
    Accounting::Balances::Query.new(organization: organization, fiscal_year: fiscal_year, account_ids: [ bank.id ])
                               .call.find { |row| row.currency_id == eur.id }
  end

  before do
    organization.accounting_setting.update!(default_fx_gain_account: fx_gain, default_fx_loss_account: fx_loss)
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 3, 1), lines: [
      je_line(bank, debit: 110, currency: eur, rate: 1.1), je_line(revenue, credit: 110)
    ])
    create(:accounting_exchange_rate, organization: organization, currency: eur, date: Date.new(2024, 6, 28), rate: "1.25")
  end

  describe Accounting::CurrencyRevaluationSchedule do
    it "validates the recurrence rule" do
      schedule = build(:accounting_currency_revaluation_schedule, organization: organization, rrule: "FREQ=SOMETIMES")
      expect(schedule).not_to be_valid
      expect(schedule.errors[:rrule]).to be_present

      schedule.rrule = "FREQ=HOURLY"
      expect(schedule).not_to be_valid
      expect(schedule.errors[:rrule]).to include(/daily, weekly, monthly or yearly/)

      # A second FREQ or several times a day would bypass the frequency limit.
      schedule.rrule = "FREQ=DAILY;FREQ=HOURLY"
      expect(schedule).not_to be_valid
      expect(schedule.errors[:rrule]).to include(/not a valid recurrence rule/)

      schedule.rrule = "FREQ=DAILY;BYHOUR=1,2,3"
      expect(schedule).not_to be_valid
      expect(schedule.errors[:rrule]).to include(/daily, weekly, monthly or yearly/)

      schedule.rrule = "FREQ=DAILY;BYMINUTE=0,30"
      expect(schedule).not_to be_valid

      schedule.rrule = "FREQ=DAILY;BYHOUR=23;BYMINUTE=30"
      expect(schedule).to be_valid

      schedule.rrule = "RRULE:freq=monthly;bymonthday=-1"
      expect(schedule).to be_valid
      expect(schedule.rrule).to eq("FREQ=MONTHLY;BYMONTHDAY=-1")
    end

    it "rejects unknown kinds and policies" do
      schedule = build(:accounting_currency_revaluation_schedule, organization: organization, default_kind: "forever")
      expect(schedule).not_to be_valid
    end

    it "computes the next run in the organization's time zone" do
      travel_to Time.utc(2024, 6, 30, 12) do
        schedule = schedule!(rrule: "FREQ=MONTHLY;BYMONTHDAY=-1")
        expect(schedule.next_run_at).to eq(tehran.local(2024, 6, 30, 23, 0))
        expect(schedule.run_date(schedule.next_run_at)).to eq(Date.new(2024, 6, 30))
      end
    end

    it "keeps the local time across daylight saving changes" do
      newyork = ActiveSupport::TimeZone["America/New_York"]
      organization.update!(time_zone: "America/New_York")
      travel_to Time.utc(2024, 3, 9, 12) do
        schedule = schedule!(dtstart: newyork.local(2024, 1, 1, 22, 0))
        runs = schedule.occurrences_after(Time.current, limit: 2)
        expect(runs.map { |t| t.in_time_zone(newyork).hour }).to eq([ 22, 22 ])
        expect(runs.map(&:utc_offset).uniq.size).to eq(2)
      end
    end

    it "clears the next run when deactivated" do
      schedule = schedule!
      schedule.update!(active: false)
      expect(schedule.next_run_at).to be_nil
    end
  end

  describe Accounting::Revaluation::ScheduledRun do
    it "posts a revaluation as of the run's local date" do
      schedule = schedule!
      result = run(schedule, tehran.local(2024, 6, 30, 23, 0))

      expect(result.status).to eq("posted")
      expect(result.revaluation).to have_attributes(as_of_date: Date.new(2024, 6, 30), schedule_id: schedule.id,
                                                    kind: "temporary", status: "posted")
      expect(bank_balance.base_balance).to eq(125)
      expect(schedule.reload).to have_attributes(last_run_status: "posted", last_revaluation_id: result.revaluation.id)
      expect(schedule.last_run_details).to include("as_of_date" => "2024-06-30", "posted_items" => 1)
    end

    it "replaces the previous temporary run" do
      schedule = schedule!
      first = run(schedule, tehran.local(2024, 6, 30, 23, 0)).revaluation
      create(:accounting_exchange_rate, organization: organization, currency: eur, date: Date.new(2024, 7, 1), rate: "1.2")
      run(schedule, tehran.local(2024, 7, 1, 23, 0))

      expect(first.reload).to be_superseded
      expect(bank_balance.base_balance).to eq(120)
    end

    it "records no change without creating anything" do
      # Permanent: the second run finds the balance already revalued. (A
      # temporary run would replace the first one and post it again.)
      schedule = schedule!(kind: :permanent)
      run(schedule, tehran.local(2024, 6, 30, 23, 0))
      result = run(schedule, tehran.local(2024, 7, 1, 23, 0))

      expect(result.status).to eq("no_change")
      expect(Accounting::CurrencyRevaluation.where(status: :draft)).to be_empty
    end

    it "skips dates without an open fiscal year" do
      schedule = schedule!
      fiscal_year.update_column(:status, FiscalYear.statuses[:closing])
      result = run(schedule, tehran.local(2024, 6, 30, 23, 0))
      expect(result.status).to eq("skipped")
      expect(result.details["reason"]).to eq("fiscal_year_not_open")

      expect(run(schedule, tehran.local(2030, 1, 1, 23, 0)).details["reason"]).to eq("no_fiscal_year")
    end

    it "records items without rates" do
      schedule = schedule!
      result = run(schedule, tehran.local(2024, 5, 1, 23, 0))
      expect(result.status).to eq("no_change")
      expect(result.details).to include("excluded_missing_rate" => 1)
    end

    describe "permanent runs with unapproved entries" do
      let(:receivable) { create_account_in(organization, "CA", ledger_code: "20", monetary: true, name: "Receivable") }

      before do
        post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 4, 1), lines: [
          je_line(receivable, debit: 55, currency: eur, rate: 1.1), je_line(revenue, credit: 55)
        ])
        post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 6, 1), state: :booked, lines: [
          je_line(bank, debit: 11, currency: eur, rate: 1.1), je_line(revenue, credit: 11)
        ])
      end

      it "posts the clean part (partial)" do
        result = run(schedule!(kind: :permanent, on_unapproved: :partial), tehran.local(2024, 6, 30, 23, 0))
        expect(result.status).to eq("posted")
        expect(result.revaluation).to be_permanent
        expect(result.revaluation.journal_entry.items.map(&:account_id)).to include(receivable.id)
        expect(result.revaluation.journal_entry.items.map(&:account_id)).not_to include(bank.id)
        expect(result.details).to include("excluded_blocked_by_unapproved" => 1)
      end

      it "posts nothing (skip)" do
        result = run(schedule!(kind: :permanent, on_unapproved: :skip), tehran.local(2024, 6, 30, 23, 0))
        expect(result.status).to eq("blocked")
        expect(result.details["blocked"]).to eq(1)
        expect(Accounting::CurrencyRevaluation.count).to eq(0)
      end

      it "posts everything as temporary (post_temporary)" do
        result = run(schedule!(kind: :permanent, on_unapproved: :post_temporary), tehran.local(2024, 6, 30, 23, 0))
        expect(result.status).to eq("posted")
        expect(result.revaluation).to be_temporary
        expect(result.revaluation.journal_entry.items.map(&:account_id)).to include(bank.id, receivable.id)
      end
    end
  end

  describe Accounting::Revaluation::DispatchJob do
    it "enqueues one run per due occurrence and advances the schedule" do
      schedule = travel_to(Time.utc(2024, 6, 29, 12)) { schedule! }
      due_at = schedule.next_run_at
      now = due_at + 5.minutes

      expect { described_class.perform_now(now) }
        .to have_enqueued_job(Accounting::Revaluation::ScheduledRunJob).with(schedule.id, due_at.utc.iso8601).exactly(:once)
      expect(schedule.reload.next_run_at).to eq(due_at + 1.day)

      # A second dispatch for the same time finds nothing due.
      expect { described_class.perform_now(now) }.not_to have_enqueued_job(Accounting::Revaluation::ScheduledRunJob)
    end

    it "catches up missed occurrences with one run for the latest" do
      schedule = travel_to(Time.utc(2024, 6, 20, 12)) { schedule! }
      now = schedule.next_run_at + 3.days + 1.hour

      expect { described_class.perform_now(now) }
        .to have_enqueued_job(Accounting::Revaluation::ScheduledRunJob).exactly(:once)
      expect(schedule.reload.next_run_at).to be > now
    end

    it "keeps dispatching when one schedule fails" do
      broken, healthy = travel_to(Time.utc(2024, 6, 29, 12)) { [ schedule!, schedule! ] }
      broken.update_columns(rrule: "FREQ=NONSENSE")
      now = healthy.next_run_at + 5.minutes

      expect { described_class.perform_now(now) }
        .to have_enqueued_job(Accounting::Revaluation::ScheduledRunJob).with(healthy.id, anything).exactly(:once)
    end

    it "ignores inactive schedules" do
      schedule = travel_to(Time.utc(2024, 6, 29, 12)) { schedule! }
      schedule.update_columns(active: false)
      expect { described_class.perform_now(schedule.next_run_at + 1.minute) }
        .not_to have_enqueued_job(Accounting::Revaluation::ScheduledRunJob)
    end
  end

  describe Accounting::Revaluation::ScheduledRunJob do
    it "runs once per occurrence" do
      schedule = schedule!
      at = tehran.local(2024, 6, 30, 23, 0).iso8601

      described_class.perform_now(schedule.id, at)
      described_class.perform_now(schedule.id, at)

      expect(Accounting::CurrencyRevaluation.where(schedule: schedule).count).to eq(1)
    end
  end
end
