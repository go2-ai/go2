# spec/models/accounting/account_spec.rb
require "rails_helper"
require "securerandom"

RSpec.describe Accounting::Account, type: :model do
  describe "database schema" do
    it { should have_db_column(:ledger_id).of_type(:integer).with_options(null: false) }
    it { should have_db_column(:code).of_type(:string).with_options(null: false) }
    it { should have_db_column(:name).of_type(:jsonb).with_options(null: false, default: {}) }
    it { should have_db_column(:contra_for_id).of_type(:integer) }
    it { should have_db_column(:accepts_other_currencies).of_type(:boolean).with_options(null: false) }
    it { should have_db_column(:allowed_center_types_1).of_type(:integer) }
    it { should have_db_column(:allowed_center_types_2).of_type(:integer) }
    it { should have_db_column(:allowed_center_types_3).of_type(:integer) }
    it { should have_db_column(:allowed_center_types_4).of_type(:integer) }
    it { should have_db_column(:allowed_center_types_5).of_type(:integer) }
    it { should have_db_column(:allowed_center_types_6).of_type(:integer) }
    it { should have_db_column(:created_at).of_type(:datetime) }
    it { should have_db_column(:updated_at).of_type(:datetime) }

    it { should have_db_index(:ledger_id) }
    it { should have_db_index(:contra_for_id) }
  end

  let(:organization) do
    create(:organization, name: { en: "Account Org #{SecureRandom.uuid}" })
  end
  let!(:account_category) { organization.account_categories.find_by!(identifier: "CA") }
  let(:ledger) { create(:accounting_ledger, account_category: account_category, code: "10") }

  describe "associations" do
    subject { build(:accounting_account, ledger: ledger) }

    it do
      should belong_to(:parent_account)
        .class_name("Accounting::Account")
        .with_foreign_key("contra_for_id")
        .optional(true)
    end
    it do
      should have_many(:contra_account)
        .class_name("Accounting::Account")
        .with_foreign_key("contra_for_id")
        .dependent(:nullify)
    end
  end

  describe "delegations" do
    subject(:account) { build(:accounting_account, ledger: ledger) }

    it "delegates account_category to ledger" do
      expect(account.account_category).to eq(account_category)
    end

    it "delegates organization to ledger" do
      expect(account.organization).to eq(organization)
    end
  end

  describe "validations" do
    it "validates presence of code" do
      account = build(:accounting_account, ledger: ledger, code: nil)

      expect(account).not_to be_valid
      expect(account.errors[:code]).to include("can't be blank")
    end

    it "validates uniqueness of code within the ledger scope" do
      code = "11"
      create(:accounting_account, ledger: ledger, code: code)

      duplicate = build(:accounting_account, ledger: ledger, code: code)

      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:code]).to include("has already been taken")
    end

    describe "code length validation" do
      it "is valid when code length matches account_length" do
        account = build(:accounting_account, ledger: ledger, code: "11")

        expect(account).to be_valid
      end

      it "is invalid when code length does not match account_length" do
        account = build(:accounting_account, ledger: ledger, code: "1")

        expect(account).not_to be_valid
        expect(account.errors[:code]).to include(/must be exactly/)
      end

      it "is valid with a custom account_length" do
        organization.accounting_setting.update!(account_length: 3)
        account = build(:accounting_account, ledger: ledger, code: "111")

        expect(account).to be_valid
      end

      it "does not validate code length when account_length is blank" do
        organization.accounting_setting.update!(account_length: nil)
        account = build(:accounting_account, ledger: ledger, code: "1")

        expect(account).to be_valid
      end
    end
  end

  describe "self-referential associations" do
    it "returns the parent account" do
      parent = create(:accounting_account, ledger: ledger, code: "11")
      account = create(:accounting_account, ledger: ledger, code: "12", contra_for_id: parent.id)

      expect(account.parent_account).to eq(parent)
      expect(parent.contra_account).to include(account)
    end

    it "nullifies contra_for_id on children when the parent is destroyed" do
      parent = create(:accounting_account, ledger: ledger, code: "11")
      account = create(:accounting_account, ledger: ledger, code: "12", contra_for_id: parent.id)

      parent.destroy
      account.reload

      expect(account.contra_for_id).to be_nil
    end
  end

  describe "PaperTrail" do
    it { should be_versioned }

    it "tracks changes to account attributes" do
      account = create(
        :accounting_account,
        ledger: ledger,
        code: "11",
        name: { "en" => "Cash", "fa" => "نقد" }
      )

      PaperTrail.enabled = true

      expect {
        Mobility.with_locale(:en) { account.update!(name: "Updated Cash") }
      }.to change { account.versions.count }.by(1)

      version = account.versions.last

      expect(version).not_to be_nil
      expect(version.event).to eq("update")
      expect(version.item_type).to eq("Accounting::Account")
      expect(version.item_id).to eq(account.id)
    end
  end

  describe "translations" do
    it "supports name translations" do
      account = create(
        :accounting_account,
        ledger: ledger,
        code: "11",
        name: { "en" => "Cash", "fa" => "نقد" }
      )

      Mobility.with_locale(:en) { expect(account.name).to eq("Cash") }
      Mobility.with_locale(:fa) { expect(account.name).to eq("نقد") }
    end

    it "uses fallbacks if translation is missing" do
      account = create(
        :accounting_account,
        ledger: ledger,
        code: "11",
        name: { "en" => "Cash" }
      )

      Mobility.with_locale(:fa) { expect(account.name).to eq("Cash") }
    end
  end
end
