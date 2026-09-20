# frozen_string_literal: true

require "rails_helper"

RSpec.describe Accounting::ChartOfAccountsAi::ContextBuilder do
  let(:organization) { create(:organization, locale: "en", active_locales: [ "fa" ]) }

  subject(:text) { described_class.call(organization: organization) }

  describe "the organization block" do
    it "includes the primary locale" do
      expect(text).to include("Primary locale: en")
    end

    it "includes the active locales" do
      expect(text).to include("Active locales: fa")
    end
  end

  describe "the system categories block" do
    it "lists every system category with its code" do
      %w[CA LA CL LL OE RE EX CO ME].each do |identifier|
        expect(text).to include("#{identifier} (code:")
      end
    end

    it "explains that system categories need not be declared" do
      expect(text).to include("You do NOT need to declare these")
    end
  end

  describe "the accounting settings block" do
    it "includes the three code-length settings" do
      settings = organization.accounting_setting
      expect(text).to include("account_category_length: #{settings.account_category_length}")
      expect(text).to include("ledger_length: #{settings.ledger_length}")
      expect(text).to include("account_length: #{settings.account_length}")
    end

    context "when the organization has no accounting_setting" do
      let(:organization_without_settings) do
        org = create(:organization)
        org.accounting_setting.delete
        org.association(:accounting_setting).reset
        org
      end

      it "warns that a proposal cannot be produced" do
        result = described_class.call(organization: organization_without_settings)
        expect(result).to include("This organization has no accounting_setting")
      end
    end
  end

  describe "the starter catalogs block" do
    it "lists service_company" do
      expect(text).to include("service_company")
    end

    it "includes the English label" do
      expect(text).to include("Service Company")
    end

    it "explains that catalogs can be used as a starting point" do
      expect(text).to include("You may base your proposal on one of these catalogs")
    end
  end

  describe "the locales block" do
    it "instructs the AI to always include the primary locale" do
      expect(text).to include('You must always include the primary locale')
      expect(text).to include('"en"')
    end
  end

  describe "output shape" do
    it "returns a String" do
      expect(text).to be_a(String)
    end

    it "sections are separated by blank lines" do
      expect(text).to include("\n\n")
    end
  end
end
