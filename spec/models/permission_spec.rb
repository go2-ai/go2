require 'rails_helper'

RSpec.describe Permission, type: :model do
  describe "database schema" do
    it { should have_db_column(:code).of_type(:string).with_options(null: false) }
    it { should have_db_column(:grantee_type).of_type(:string) }
    it { should have_db_column(:grantee_id).of_type(:integer) }
    it { should have_db_column(:created_at).of_type(:datetime) }
    it { should have_db_column(:updated_at).of_type(:datetime) }

    it { should have_db_index([ :code, :grantee_type, :grantee_id ]) }
    it { should have_db_index([ :grantee_type, :grantee_id ]) }
    it { should have_db_index([ :code ]) }
    it { should have_db_index([ :grantee_id ]) }
    it { should have_db_index([ :grantee_type ]) }
  end

  describe "validations" do
    it { should validate_presence_of(:code) }
    it { should validate_presence_of(:grantee) }
  end

  describe "associations" do
    it { should belong_to(:organization).optional(false) }
    it { should belong_to(:grantee) }
  end

  describe "PaperTrail" do
    it { should be_versioned }

    it "tracks changes to permission attributes" do
      organization = create(:organization)
      department = create(:department, organization: organization)
      permission = create(:permission, code: "department.add_role", grantee: department, organization: organization)

      expect {
        permission.destroy
      }.to change { permission.versions.count }.by(1)
      expect(permission.versions.last.event).to eq("destroy")
    end
  end

  describe ".dependents_for" do
    it "returns permissions that list the given code as a prerequisite" do
      expect(Permission.dependents_for(Permission::ACCOUNTING_VIEW_ACCOUNTS)).to include(Permission::ACCOUNTING_MANAGE_ACCOUNTS)
    end

    it "returns an empty array for a code nothing depends on" do
      expect(Permission.dependents_for(Permission::ORG_ADMIN)).to eq([])
    end
  end

  describe "fiscal year closing and revaluation permissions" do
    it "are grantable" do
      codes = Permission.grantable_permissions.map { |p| p[:code] }
      expect(codes).to include(
        Permission::ACCOUNTING_VIEW_EXCHANGE_RATES,
        Permission::ACCOUNTING_MANAGE_EXCHANGE_RATES,
        Permission::ACCOUNTING_REVALUE_CURRENCIES,
        Permission::ACCOUNTING_CLOSE_FISCAL_YEARS
      )
    end

    it "require viewing exchange rates to manage them" do
      expect(Permission.prerequisites_for(Permission::ACCOUNTING_MANAGE_EXCHANGE_RATES))
        .to eq([ Permission::ACCOUNTING_VIEW_EXCHANGE_RATES ])
    end

    it "require viewing journal entries and exchange rates to revalue currencies" do
      expect(Permission.prerequisites_for(Permission::ACCOUNTING_REVALUE_CURRENCIES))
        .to contain_exactly(Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES, Permission::ACCOUNTING_VIEW_EXCHANGE_RATES)
    end

    it "require approving (and so viewing) journal entries to close fiscal years" do
      expect(Permission.prerequisites_for(Permission::ACCOUNTING_CLOSE_FISCAL_YEARS))
        .to contain_exactly(Permission::ACCOUNTING_APPROVE_JOURNAL_ENTRIES, Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES)
    end
  end
end
