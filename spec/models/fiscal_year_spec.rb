require 'rails_helper'
require 'securerandom'

RSpec.describe FiscalYear, type: :model do
  describe "database schema" do
    it { should have_db_column(:name).of_type(:jsonb).with_options(null: false, default: {}) }
    it { should have_db_column(:start_date).of_type(:date) }
    it { should have_db_column(:finish_date).of_type(:date) }
    it { should have_db_column(:organization_id).of_type(:integer).with_options(null: false) }
    it { should have_db_column(:created_at).of_type(:datetime) }
    it { should have_db_column(:updated_at).of_type(:datetime) }

    it { should have_db_index(:finish_date) }
    it { should have_db_index(:name).using(:gin) }
    it { should have_db_index(:organization_id) }
    it { should have_db_index(:start_date) }
  end

  let(:organization) { create(:organization, name: { en: "FiscalYear Org #{SecureRandom.uuid}" }) }

  describe "associations" do
    it { should belong_to(:organization) }
  end

  describe "validations" do
    it "is not valid with a name not containing at least one translation" do
      fiscal_year = build(:fiscal_year, organization: organization, name: {})
      expect(fiscal_year).not_to be_valid
      expect(fiscal_year.errors[:name].join(", ")).to include("must contain at least one")
    end

    it "is valid with a name containing at least one translation" do
      fiscal_year = build(:fiscal_year, organization: organization, name: { en: "FY 2024" })
      expect(fiscal_year).to be_valid
    end

    it "validates presence of start_date" do
      fiscal_year = build(:fiscal_year, organization: organization, start_date: nil)
      expect(fiscal_year).not_to be_valid
      expect(fiscal_year.errors[:start_date]).to include("can't be blank")
    end

    it "validates presence of finish_date" do
      fiscal_year = build(:fiscal_year, organization: organization, finish_date: nil)
      expect(fiscal_year).not_to be_valid
      expect(fiscal_year.errors[:finish_date]).to include("can't be blank")
    end

    it "is invalid when start_date is after finish_date" do
      fiscal_year = build(:fiscal_year,
        organization: organization,
        start_date: Date.new(2024, 12, 31),
        finish_date: Date.new(2024, 1, 1)
      )
      expect(fiscal_year).not_to be_valid
      expect(fiscal_year.errors[:start_date]).to include(/must be before or equal to finish date/)
    end

    it "is valid when start_date equals finish_date" do
      fiscal_year = build(:fiscal_year,
        organization: organization,
        start_date: Date.new(2024, 1, 1),
        finish_date: Date.new(2024, 1, 1)
      )
      expect(fiscal_year).to be_valid
    end

    it "is valid when start_date is before finish_date" do
      fiscal_year = build(:fiscal_year,
        organization: organization,
        start_date: Date.new(2024, 1, 1),
        finish_date: Date.new(2024, 12, 31)
      )
      expect(fiscal_year).to be_valid
    end
  end

  describe "no gap or overlap validation" do
    context "when there are no existing fiscal years" do
      it "allows the first fiscal year" do
        fiscal_year = build(:fiscal_year,
          organization: organization,
          start_date: Date.new(2024, 1, 1),
          finish_date: Date.new(2024, 12, 31)
        )
        expect(fiscal_year).to be_valid
      end
    end

    context "when a fiscal year already exists" do
      let!(:existing_fy) do
        create(:fiscal_year,
          organization: organization,
          start_date: Date.new(2024, 1, 1),
          finish_date: Date.new(2024, 12, 31)
        )
      end

      it "is valid when start_date is exactly one day after previous finish_date" do
        fiscal_year = build(:fiscal_year,
          organization: organization,
          start_date: Date.new(2025, 1, 1),
          finish_date: Date.new(2025, 12, 31)
        )
        expect(fiscal_year).to be_valid
      end

      it "is invalid when there is a gap between fiscal years" do
        fiscal_year = build(:fiscal_year,
          organization: organization,
          start_date: Date.new(2025, 1, 2),
          finish_date: Date.new(2025, 12, 31)
        )
        expect(fiscal_year).not_to be_valid
        expect(fiscal_year.errors[:start_date]).to include(/must be exactly one day after/)
      end

      it "is invalid when there is overlap between fiscal years" do
        fiscal_year = build(:fiscal_year,
          organization: organization,
          start_date: Date.new(2024, 12, 1),
          finish_date: Date.new(2025, 12, 31)
        )
        expect(fiscal_year).not_to be_valid
        expect(fiscal_year.errors[:base]).to include(/overlaps with an existing fiscal year/)
      end

      it "is invalid when trying to insert a fiscal year in the middle" do
        create(:fiscal_year,
          organization: organization,
          start_date: Date.new(2025, 1, 1),
          finish_date: Date.new(2025, 12, 31)
        )

        fiscal_year = build(:fiscal_year,
          organization: organization,
          start_date: Date.new(2024, 6, 1),
          finish_date: Date.new(2024, 6, 30)
        )
        expect(fiscal_year).not_to be_valid
      end
    end

    context "when updating an existing fiscal year" do
      let!(:fy1) do
        create(:fiscal_year,
          organization: organization,
          start_date: Date.new(2024, 1, 1),
          finish_date: Date.new(2024, 12, 31)
        )
      end

      let!(:fy2) do
        create(:fiscal_year,
          organization: organization,
          start_date: Date.new(2025, 1, 1),
          finish_date: Date.new(2025, 12, 31)
        )
      end

      it "allows updating name without changing dates" do
        expect {
          Mobility.with_locale(:en) { fy1.update!(name: "Updated FY") }
        }.not_to raise_error
      end

      it "is invalid when changing finish_date creates a gap" do
        fy1.finish_date = Date.new(2024, 11, 30)
        expect(fy1).not_to be_valid
        puts fy1.errors.full_messages
        expect(fy1.errors.full_messages).to include(/must be exactly one day/)
      end

      it "is invalid when changing finish_date creates overlap" do
        fy1.finish_date = Date.new(2025, 3, 31)
        expect(fy1).not_to be_valid
        expect(fy1.errors[:base]).to include(/overlaps with an existing fiscal year/)
      end
    end
  end

  describe "PaperTrail" do
    it { should be_versioned }

    it "tracks changes to fiscal year attributes" do
      fiscal_year = create(:fiscal_year, organization: organization)

      PaperTrail.enabled = true

      expect {
        Mobility.with_locale(:en) { fiscal_year.update!(name: "Updated Fiscal Year") }
      }.to change { fiscal_year.versions.count }.by(1)

      version = fiscal_year.versions.last
      expect(version).not_to be_nil
      expect(version.event).to eq("update")
      expect(version.item_type).to eq("FiscalYear")
      expect(version.item_id).to eq(fiscal_year.id)
    end
  end

  describe "translations" do
    it "supports name translations" do
      fiscal_year = create(:fiscal_year,
        organization: organization,
        name: { "en" => "Fiscal Year 2024", "fa" => "سال مالی ۲۰۲۴" }
      )

      Mobility.with_locale(:en) { expect(fiscal_year.name).to eq("Fiscal Year 2024") }
      Mobility.with_locale(:fa) { expect(fiscal_year.name).to eq("سال مالی ۲۰۲۴") }
    end

    it "uses fallbacks if translation is missing" do
      fiscal_year = create(:fiscal_year,
        organization: organization,
        name: { "en" => "Fiscal Year 2024" }
      )

      Mobility.with_locale(:fa) { expect(fiscal_year.name).to eq("Fiscal Year 2024") }
    end
  end
end
