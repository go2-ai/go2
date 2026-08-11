require 'rails_helper'

RSpec.describe Accounting::Setting, type: :model do
  describe "database schema" do
    it { should have_db_column(:organization_id).of_type(:integer).with_options(null: false) }
    it { should have_db_column(:main_currency_id).of_type(:integer) }
    it { should have_db_column(:use_parent_org_currencies).of_type(:boolean).with_options(default: false) }
    it { should have_db_column(:use_parent_org_accounts).of_type(:boolean).with_options(default: false) }
    it { should have_db_column(:use_parent_org_centers).of_type(:boolean).with_options(default: false) }
    it { should have_db_column(:use_parent_org_fiscal_years).of_type(:boolean).with_options(default: false) }
    it { should have_db_column(:account_category_length).of_type(:integer).with_options(default: 1) }
    it { should have_db_column(:ledger_length).of_type(:integer).with_options(default: 2) }
    it { should have_db_column(:account_length).of_type(:integer).with_options(default: 2) }
    it { should have_db_column(:center_length).of_type(:integer).with_options(default: 6) }
    it { should have_db_column(:center_levels).of_type(:integer).with_options(default: 3) }
    it { should have_db_column(:created_at).of_type(:datetime) }
    it { should have_db_column(:updated_at).of_type(:datetime) }

    it { should have_db_index(:organization_id).unique(true) }
    it { should have_db_index(:main_currency_id) }
  end

  describe "associations" do
    it { should belong_to(:organization) }
    it { should belong_to(:main_currency).class_name('Currency').optional(true) }
  end

  describe "validations" do
    it "validates uniqueness of organization_id" do
      organization = create(:organization)

      duplicate = build(:accounting_setting, organization:)
      expect(duplicate).not_to be_valid
      expect(duplicate.errors[:organization_id]).to include("has already been taken")
    end
  end
end
