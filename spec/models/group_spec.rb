require 'rails_helper'
require 'securerandom'

RSpec.describe Group, type: :model do
  describe "database schema" do
    it { should have_db_column(:name).of_type(:jsonb).with_options(null: false) }
    it { should have_db_column(:description).of_type(:jsonb) }
    it { should have_db_column(:organization_id).of_type(:integer) }
    it { should have_db_column(:created_at).of_type(:datetime) }
    it { should have_db_column(:updated_at).of_type(:datetime) }

    it { should have_db_index(:name).using(:gin) }
    it { should have_db_index([ :organization_id ]) }
  end

  describe "validations" do
    it "validates uniqueness of name within organization scope" do
      # Create organizations with random names to avoid uniqueness conflicts
      org1 = create(:organization, name: { en: "Org Test #{rand(1000)}" })
      org2 = create(:organization, name: { en: "Org Test #{rand(1000)}" })

      # Create a group in the first organization
      test_group_name = "Test Group Name"
      group1 = create(:group, organization: org1, name: test_group_name)

      # Try to create another group with the same name in the same organization - should fail
      group2 = build(:group, organization: org1, name: test_group_name)
      expect(group2).not_to be_valid

      # Create a group with the same name but in a different organization - should work
      group3 = build(:group, organization: org2, name: test_group_name)
      expect(group3).to be_valid
    end
  end

  describe "associations" do
    it { should belong_to(:organization).optional(false) }
    it { should have_and_belong_to_many(:members) }
    it { should have_many(:permissions).as(:grantee) }
  end

  describe "PaperTrail" do
    it { should be_versioned }

    it "tracks changes to group attributes" do
      # Create a group with a specific name
      org = create(:organization, name: { en: "Org PaperTrail Test #{rand(10000)}" })
      group = create(:group, organization: org, name: { en: "Original Name #{rand(10000)}" })

      # Make sure PaperTrail is enabled
      PaperTrail.enabled = true

      # Update the group with a new name
      new_name = "Updated Name #{rand(10000)}"

      # Update the group and verify a version is created
      expect {
        Mobility.with_locale(:en) { group.update!(name: new_name) }
      }.to change { group.versions.count }.by(1)

      # Reload the group to ensure all associations are fresh
      group.reload

      # Verify the version exists with expected attributes
      version = group.versions.last
      expect(version).not_to be_nil
      expect(version.event).to eq("update")
      expect(version.item_type).to eq("Group")
      expect(version.item_id).to eq(group.id)
    end
  end

  describe "#add_member" do
    # Create a new organization for this test group to avoid uniqueness conflicts
    let(:org) { create(:organization, name: { en: "Add Member Org #{SecureRandom.uuid}" }) }
    let(:group) { create(:group, organization: org) }
    let(:member) { create(:member, organization: org) }

    it "adds a member to the group" do
      expect {
        group.add_member(member)
      }.to change { group.members.count }.by(1)

      expect(group.members).to include(member)
    end

    it "doesn't add the same member twice" do
      group.add_member(member)

      expect {
        group.add_member(member)
      }.not_to change { group.members.count }
    end
  end

  describe "#remove_member" do
    # Create a new organization for this test group to avoid uniqueness conflicts
    let(:org) { create(:organization, name: { en: "Remove Member Org #{SecureRandom.uuid}" }) }
    let(:group) { create(:group, organization: org) }
    let(:member) { create(:member, organization: org) }

    before do
      group.add_member(member)
    end

    it "removes a member from the group" do
      expect {
        group.remove_member(member)
      }.to change { group.members.count }.by(-1)

      expect(group.members).not_to include(member)
    end

    it "does nothing if member is not in group" do
      group.remove_member(member)

      expect {
        group.remove_member(member)
      }.not_to change { group.members.count }
    end
  end
end
