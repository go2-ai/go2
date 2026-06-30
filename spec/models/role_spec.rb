require 'rails_helper'
require 'securerandom'

RSpec.describe Role, type: :model do
  describe "database schema" do
    it { should have_db_column(:name).of_type(:jsonb).with_options(null: false) }
    it { should have_db_column(:description).of_type(:jsonb) }
    it { should have_db_column(:parent_id).of_type(:integer) }
    it { should have_db_column(:organization_id).of_type(:integer) }
    it { should have_db_column(:department_id).of_type(:integer) }
    it { should have_db_column(:active).of_type(:boolean).with_options(default: true) }
    it { should have_db_column(:created_at).of_type(:datetime) }
    it { should have_db_column(:updated_at).of_type(:datetime) }

    it { should have_db_index(:name).using(:gin) }
    it { should have_db_index([ :parent_id ]) }
    it { should have_db_index([ :organization_id ]) }
    it { should have_db_index([ :department_id ]) }
  end

  describe "validations" do
    let(:organization) { create(:organization, name: { en: "Validation Org #{SecureRandom.uuid}" }) }

    it "is not valid with a name does not containing at least one translation" do
      role = build(:role, name: {}, organization: organization)
      expect(role).not_to be_valid
      expect(role.errors[:name].join("")).to include("must contain at least one")
    end

    it "is valid with a name containing at least one translation" do
      role = build(:role, organization: organization, name: { en: "Manager" })
      expect(role).to be_valid
    end

    it "prevents circular references" do
      parent_role = create(:role, organization: organization)
      child_role = create(:role, parent: parent_role, organization: organization)

      parent_role.parent_id = child_role.id
      expect(parent_role).not_to be_valid
      expect(parent_role.errors[:parent_id]).to include("circular reference detected")
    end
  end

  describe "associations" do
    it { should belong_to(:organization).optional(false) }
    it { should belong_to(:department).optional(true) }
    it { should belong_to(:parent).class_name('Role').optional(true) }
    it { should have_many(:children).class_name('Role').with_foreign_key('parent_id') }
    it { should have_many(:permissions).as(:grantee) }
  end

  describe "PaperTrail" do
    it { should be_versioned }

    it "tracks changes to role attributes" do
      org = create(:organization, name: { en: "PaperTrail Org #{SecureRandom.uuid}" })
      role = create(:role, organization: org)

      PaperTrail.enabled = true

      new_name = "Updated Role Name #{SecureRandom.uuid}"
      expect {
        Mobility.with_locale(:en) { role.update!(name: new_name) }
      }.to change { role.versions.count }.by(1)

      version = role.versions.last
      expect(version).not_to be_nil
      expect(version.event).to eq("update")
      expect(version.item_type).to eq("Role")
      expect(version.item_id).to eq(role.id)
    end
  end

  describe "scopes" do
    let(:organization) { create(:organization, name: { en: "Scopes Org #{SecureRandom.uuid}" }) }
    let!(:active_role) { create(:role, organization: organization, active: true) }
    let!(:inactive_role) { create(:role, :inactive, organization: organization) }

    it "returns active roles" do
      expect(Role.active).to include(active_role)
      expect(Role.active).not_to include(inactive_role)
    end
  end

  describe "#ancestors" do
    let(:organization) { create(:organization, name: { en: "Ancestors Org #{SecureRandom.uuid}" }) }
    let(:grandparent) { create(:role, organization: organization, name: { en: "Grandparent" }) }
    let(:parent) { create(:role, organization: organization, name: { en: "Parent" }, parent: grandparent) }
    let(:child) { create(:role, organization: organization, name: { en: "Child" }, parent: parent) }

    it "returns all ancestors in correct order" do
      expect(child.ancestors).to eq([ child, parent, grandparent ])
      expect(parent.ancestors).to eq([ parent, grandparent ])
      expect(grandparent.ancestors).to eq([ grandparent ])
    end
  end

  describe "#descendants" do
    let(:organization) { create(:organization, name: { en: "Descendants Org #{SecureRandom.uuid}" }) }
    let(:parent) { create(:role, organization: organization, name: { en: "Parent" }) }
    let(:child1) { create(:role, organization: organization, name: { en: "Child 1" }, parent: parent) }
    let(:child2) { create(:role, organization: organization, name: { en: "Child 2" }, parent: parent) }
    let(:grandchild) { create(:role, organization: organization, name: { en: "Grandchild" }, parent: child1) }

    before do
      # Create all roles
      parent
      child1
      child2
      grandchild
    end

    it "returns all descendants" do
      descendants = parent.descendants

      expect(descendants).to include(parent)
      expect(descendants).to include(child1)
      expect(descendants).to include(child2)
      expect(descendants).to include(grandchild)
      expect(descendants.size).to eq(4)
    end
  end

  describe "#member" do
    let(:organization) { create(:organization, name: { en: "Member Org #{SecureRandom.uuid}" }) }
    let(:member) { create(:member, organization:) }
    let!(:role) { create(:role, organization:) }

    it "returns nil when no member is assigned" do
      expect(role.member).to be_nil
    end

    it "returns the assigned member when there is an active assignment" do
      role.update(member:)
      expect(role.member).to eq(member)
    end
  end

  describe "translations" do
    let(:organization) { create(:organization, name: { en: "Translation Org #{SecureRandom.uuid}" }) }

    it "supports name translations" do
      role = create(:role, organization: organization, name: { "en" => "Manager", "fr" => "Directeur" })

      Mobility.with_locale(:en) do
        expect(role.name).to eq("Manager")
      end

      Mobility.with_locale(:fr) do
        expect(role.name).to eq("Directeur")
      end
    end

    it "uses fallbacks if translation is missing" do
      role = create(:role, organization: organization, name: { "en" => "Director" })

      Mobility.with_locale(:fr) do
        expect(role.name).to eq("Director") # Falls back to English
      end
    end

    it "returns an empty hash for name if not set" do
      role = Role.new
      expect(role.read_attribute(:name)).to eq({})
    end
  end
end
