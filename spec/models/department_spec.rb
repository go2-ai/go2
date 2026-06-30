require 'rails_helper'
require 'securerandom'

RSpec.describe Department, type: :model do
  describe "database schema" do
    it { should have_db_column(:name).of_type(:jsonb).with_options(null: false) }
    it { should have_db_column(:description).of_type(:jsonb) }
    it { should have_db_column(:organization_id).of_type(:integer) }
    it { should have_db_column(:abbreviation).of_type(:string) }
    it { should have_db_column(:created_at).of_type(:datetime) }
    it { should have_db_column(:updated_at).of_type(:datetime) }

    it { should have_db_index(:name).using(:gin) }
    it { should have_db_index([ :organization_id ]) }
  end

  describe "validations" do
    let(:organization) { create(:organization, name: { en: "Validation Org #{SecureRandom.uuid}" }) }

    it "is not valid with a name does not containing at least one translation" do
      department = build(:department, name: {}, organization: organization)
      expect(department).not_to be_valid
      expect(department.errors[:name].join(", ")).to include("must contain at least one")
    end

    it "is valid with a name containing at least one translation" do
      department = build(:department, organization: organization, name: { en: "Marketing" })
      expect(department).to be_valid
    end
  end

  describe "associations" do
    it { should belong_to(:organization).optional(false) }
    it { should have_many(:roles).dependent(:nullify) }
    it { should have_many(:permissions).as(:grantee).dependent(:destroy) }
  end

  describe "PaperTrail" do
    it { should be_versioned }

    it "tracks changes to department attributes" do
      org = create(:organization, name: { en: "PaperTrail Org #{SecureRandom.uuid}" })
      department = create(:department, organization: org)

      PaperTrail.enabled = true

      new_name = "Updated Department Name #{SecureRandom.uuid}"
      expect {
        Mobility.with_locale(:en) { department.update!(name: new_name) }
      }.to change { department.versions.count }.by(1)

      version = department.versions.last
      expect(version).not_to be_nil
      expect(version.event).to eq("update")
      expect(version.item_type).to eq("Department")
      expect(version.item_id).to eq(department.id)
    end
  end

  describe "#members" do
    let(:org) { create(:organization, name: { en: "Members Org #{SecureRandom.uuid}" }) }
    let(:department) { create(:department, organization: org) }
    let(:member1) { create(:member, organization: org) }
    let(:member2) { create(:member, organization: org) }
    let!(:role) { create(:role, department: department, organization: org, member: member2) }

    it "returns members assigned to roles in this department" do
      expect(department.members).to include(member2)
    end
  end

  describe "#member_in_department?" do
    let(:org) { create(:organization, name: { en: "Member In Dept Org #{SecureRandom.uuid}" }) }
    let(:department) { create(:department, organization: org) }
    let(:member) { create(:member, organization: org) }
    let(:other_member) { create(:member, organization: org) }
    let!(:role) { create(:role, department: department, organization: org, member:) }

    it "returns true if member is assigned to a role in this department" do
      expect(department.member_in_department?(member)).to be true
    end

    it "returns false if member is not assigned to a role in this department" do
      expect(department.member_in_department?(other_member)).to be false
    end
  end

  describe "#add_role" do
    let(:org) { create(:organization, name: { en: "Add Role Org #{SecureRandom.uuid}" }) }
    let(:department) { create(:department, organization: org) }
    let(:other_department) { create(:department, organization: org) }
    let(:role) { create(:role, organization: org, department: nil) }

    it "associates an existing role with the department" do
      expect(role.department).to be_nil

      department.add_role(role)
      role.reload

      expect(role.department).to eq(department)
    end

    it "transfers a role from another department" do
      role.update(department: other_department)

      department.add_role(role)
      role.reload

      expect(role.department).to eq(department)
    end

    it "does nothing if the role is already associated with this department" do
      role.update(department: department)

      expect {
        department.add_role(role)
      }.not_to change { role.reload.department_id }
    end
  end

  describe "#remove_role" do
    let(:org) { create(:organization, name: { en: "Remove Role Org #{SecureRandom.uuid}" }) }
    let(:department) { create(:department, organization: org) }
    let(:other_department) { create(:department, organization: org) }

    it "removes a role from the department" do
      role = create(:role, department: department, organization: org)

      expect {
        department.remove_role(role)
        role.reload
      }.to change { role.department }.from(department).to(nil)

      expect(department.roles).not_to include(role)
    end

    it "does nothing if the role doesn't belong to this department" do
      role = create(:role, department: other_department, organization: org)

      expect {
        department.remove_role(role)
      }.not_to change { role.reload.department }
    end
  end

  describe "translations" do
    let(:organization) { create(:organization) }

    it "supports name translations" do
      department = create(:department, organization: organization, name: { "en" => "Marketing", "fr" => "Marketing FR" })

      Mobility.with_locale(:en) do
        expect(department.name).to eq("Marketing")
      end

      Mobility.with_locale(:fr) do
        expect(department.name).to eq("Marketing FR")
      end
    end

    it "uses fallbacks if translation is missing" do
      department = create(:department, organization: organization, name: { "en" => "Sales" })

      Mobility.with_locale(:fr) do
        expect(department.name).to eq("Sales") # Falls back to English
      end
    end
  end
end
