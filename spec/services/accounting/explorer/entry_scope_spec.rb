require "rails_helper"

RSpec.describe Accounting::Explorer::EntryScope do
  let(:organization) { create(:organization) }
  let!(:year_2024) do
    create(:fiscal_year, organization: organization,
           start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31))
  end
  let!(:year_2025) do
    create(:fiscal_year, organization: organization,
           start_date: Date.new(2025, 1, 1), finish_date: Date.new(2025, 12, 31))
  end
  let!(:year_2026) do
    create(:fiscal_year, organization: organization,
           start_date: Date.new(2026, 1, 1), finish_date: Date.new(2026, 12, 31))
  end

  let(:bank) { create_account_in(organization, "CA", ledger_code: "10", name: "Bank") }
  let(:equity) { create_account_in(organization, "OE", ledger_code: "30", name: "Retained earnings") }
  let(:revenue) { create_account_in(organization, "RE", ledger_code: "10", name: "Sales") }

  # System entries are attributed to the year they close, like the closing services do.
  def entry(year, date, type, amount, debit:, credit:, source: nil, state: :approved)
    attrs = { entry_type: type }
    attrs.merge!(source: source, system_context: :fiscal_year_closing) if source
    post_entry(fiscal_year: year, date: date, state: state,
               lines: [ je_line(debit, debit: amount), je_line(credit, credit: amount) ], **attrs)
  end

  let!(:beginning_2024) { entry(year_2024, Date.new(2024, 1, 1), :beginning, 1000, debit: bank, credit: equity) }
  let!(:normal_2024) { entry(year_2024, Date.new(2024, 3, 1), :normal, 500, debit: bank, credit: revenue) }
  let!(:revaluation_2024) do
    entry(year_2024, Date.new(2024, 6, 1), :revaluation, 10, debit: bank, credit: revenue, source: year_2024)
  end
  let!(:closing_2024) do
    entry(year_2024, Date.new(2024, 12, 31), :closing_temp_accounts, 510, debit: revenue, credit: equity,
          source: year_2024)
  end
  let!(:ending_2024) do
    entry(year_2024, Date.new(2024, 12, 31), :ending, 1510, debit: equity, credit: bank, source: year_2024)
  end
  let!(:beginning_2025) do
    entry(year_2025, Date.new(2025, 1, 1), :beginning, 1510, debit: bank, credit: equity, source: year_2024)
  end
  let!(:normal_2025) { entry(year_2025, Date.new(2025, 3, 1), :normal, 200, debit: bank, credit: revenue) }
  let!(:booked_2025) do
    entry(year_2025, Date.new(2025, 4, 1), :normal, 30, debit: bank, credit: revenue, state: :booked)
  end
  let!(:draft_2025) do
    entry(year_2025, Date.new(2025, 5, 1), :normal, 999, debit: bank, credit: revenue, state: :draft)
  end

  def scope(**options)
    described_class.new(organization: organization, **options)
  end

  def entries(**options)
    scope(**options).apply(Accounting::JournalEntry.all).to_a
  end

  describe "within one fiscal year" do
    it "defaults to the fiscal year with beginning, normal and revaluation entries" do
      expect(entries(fiscal_year_id: year_2024.id))
        .to contain_exactly(beginning_2024, normal_2024, revaluation_2024)
    end

    it "uses the selected entry types as given" do
      types = %w[normal beginning revaluation closing_temp_accounts ending]
      expect(entries(fiscal_year_id: year_2024.id, entry_types: types))
        .to contain_exactly(beginning_2024, normal_2024, revaluation_2024, closing_2024, ending_2024)
      expect(entries(fiscal_year_id: year_2024.id, entry_types: %w[ending])).to contain_exactly(ending_2024)
    end

    it "limits entries to the date range" do
      expect(entries(from: Date.new(2024, 2, 1), to: Date.new(2024, 5, 31))).to contain_exactly(normal_2024)
    end

    it "leaves out a beginning entry before the range and reports it" do
      result = scope(from: Date.new(2024, 2, 1), to: Date.new(2024, 12, 31))

      expect(result.apply(Accounting::JournalEntry.all)).to contain_exactly(normal_2024, revaluation_2024)
      expect(result).to be_prior_entries_excluded
    end

    it "includes booked and approved entries, never drafts" do
      expect(entries(fiscal_year_id: year_2025.id)).to contain_exactly(beginning_2025, normal_2025, booked_2025)
    end

    it "can be limited to approved entries" do
      expect(entries(fiscal_year_id: year_2025.id, approved_only: true))
        .to contain_exactly(beginning_2025, normal_2025)
    end

    it "selects nothing when no entry type is selected" do
      expect(entries(fiscal_year_id: year_2024.id, entry_types: [])).to be_empty
    end
  end

  describe "across fiscal years" do
    let(:range) { { from: Date.new(2024, 1, 1), to: Date.new(2025, 12, 31) } }

    it "leaves out the year-end entries and the later beginning entries by default" do
      expect(entries(**range))
        .to contain_exactly(beginning_2024, normal_2024, revaluation_2024, normal_2025, booked_2025)
    end

    it "ignores the year-end entry types unless include_year_end is set" do
      types = %w[normal beginning revaluation closing_temp_accounts ending]
      expect(entries(**range, entry_types: types))
        .to contain_exactly(beginning_2024, normal_2024, revaluation_2024, normal_2025, booked_2025)
    end

    it "adds the year-end and later beginning entries with include_year_end" do
      expect(entries(**range, include_year_end: true))
        .to contain_exactly(beginning_2024, normal_2024, revaluation_2024, closing_2024, ending_2024,
                            beginning_2025, normal_2025, booked_2025)
    end

    it "keeps the first year's beginning entry only when beginning is selected" do
      expect(entries(**range, entry_types: %w[normal])).to contain_exactly(normal_2024, normal_2025, booked_2025)
    end

    it "leaves out the first year's beginning entry when the range starts after it" do
      expect(entries(from: Date.new(2024, 2, 1), to: Date.new(2025, 12, 31)))
        .to contain_exactly(normal_2024, revaluation_2024, normal_2025, booked_2025)
    end

    it "reports the fiscal years and the range" do
      expect(scope(from: Date.new(2024, 6, 1), to: Date.new(2026, 2, 1)).meta).to eq(
        from: "2024-06-01",
        to: "2026-02-01",
        fiscal_year_ids: [ year_2024.id, year_2025.id, year_2026.id ],
        multi_year: true,
        prior_entries_excluded: true
      )
      expect(scope(fiscal_year_id: year_2025.id).meta)
        .to include(multi_year: false, prior_entries_excluded: false, fiscal_year_ids: [ year_2025.id ])
    end
  end

  it "doesn't include other organizations' entries" do
    other = create(:organization)
    other_year = create(:fiscal_year, organization: other,
                        start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31))
    other_bank = create_account_in(other, "CA", ledger_code: "10")
    other_revenue = create_account_in(other, "RE", ledger_code: "10")
    entry(other_year, Date.new(2024, 3, 1), :normal, 5, debit: other_bank, credit: other_revenue)

    expect(entries(fiscal_year_id: year_2024.id)).to contain_exactly(beginning_2024, normal_2024, revaluation_2024)
  end

  describe "validation" do
    def error_key(**options)
      scope(**options)
    rescue Accounting::Explorer::InvalidScopeError => e
      e.key
    end

    it "needs a fiscal year of the organization or both dates" do
      expect(error_key).to eq(:fiscal_year_required)
      expect(error_key(fiscal_year_id: 0)).to eq(:fiscal_year_required)
      expect(error_key(from: Date.new(2024, 1, 1))).to eq(:fiscal_year_required)
    end

    it "rejects a start after the end" do
      expect(error_key(from: Date.new(2024, 5, 1), to: Date.new(2024, 4, 1))).to eq(:invalid_range)
    end

    it "rejects a range outside the fiscal years" do
      expect(error_key(from: Date.new(2023, 12, 31), to: Date.new(2024, 4, 1))).to eq(:out_of_range)
      expect(error_key(from: Date.new(2026, 6, 1), to: Date.new(2027, 1, 1))).to eq(:out_of_range)
    end

    it "rejects unknown entry types" do
      expect(error_key(fiscal_year_id: year_2024.id, entry_types: %w[normal bogus])).to eq(:invalid_entry_types)
    end
  end
end
