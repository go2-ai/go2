require "rails_helper"

RSpec.describe ReportTemplates::Resolver do
  let(:organization) { persian_organization(active_locales: [ "en", "fr" ]) }
  let(:member) { create(:member, name: "Member", organization: organization) }
  let(:other_member) { create(:member, name: "Other", organization: organization) }
  let!(:system_en) { create(:report_template, locale: "en") }
  let!(:system_fa) { create(:report_template, locale: "fa") }

  def resolver(for_member = member)
    described_class.new(organization: organization, member: for_member, report_key: "journal_entry")
  end

  def org_template(locale)
    create(:report_template, organization: organization, locale: locale)
  end

  it "lists the organization's locales, its primary locale first" do
    expect(resolver.locales).to eq(%w[fa en fr])
  end

  describe "#default_template" do
    it "is the system template in the organization's locale without defaults" do
      expect(resolver.default_template).to eq(system_fa)
    end

    it "is the organization default, in any locale" do
      create(:report_default, organization: organization, report_template: system_en)

      expect(resolver.default_template).to eq(system_en)
      expect(resolver.organization_default).to eq(system_en)
    end

    it "is the member's own default before the organization's" do
      mine = org_template("en")
      create(:report_default, organization: organization, report_template: system_en)
      create(:report_default, organization: organization, member: member, report_template: mine)

      expect(resolver.default_template).to eq(mine)
      expect(resolver(other_member).default_template).to eq(system_en)
    end

    it "ignores defaults in locales the organization no longer uses" do
      create(:report_default, organization: organization, report_template: org_template("ar"))

      expect(resolver.default_template).to eq(system_fa)
    end

    it "falls back to English without a system template in the organization's locale" do
      system_fa.destroy!

      expect(resolver.default_template).to eq(system_en)
    end

    it "is nil without any system template" do
      ReportTemplate.delete_all

      expect(resolver.default_template).to be_nil
    end
  end

  describe "#for_locale" do
    it "is the system template in that locale" do
      expect(resolver.for_locale("en")).to eq(system_en)
    end

    it "is a default written in that locale" do
      org_default = org_template("en")
      create(:report_default, organization: organization, report_template: org_default)

      expect(resolver.for_locale("en")).to eq(org_default)
      expect(resolver.for_locale("fa")).to eq(system_fa)
    end

    it "prefers the member's default in that locale" do
      org_default = org_template("en")
      mine = org_template("en")
      create(:report_default, organization: organization, report_template: org_default)
      create(:report_default, organization: organization, member: member, report_template: mine)

      expect(resolver.for_locale("en")).to eq(mine)
    end

    it "falls back to the organization's locale, then English" do
      expect(resolver.for_locale("fr")).to eq(system_fa)

      system_fa.destroy!
      expect(resolver.for_locale("fr")).to eq(system_en)
    end
  end

  it "maps every locale of the organization to a template" do
    expect(resolver.by_locale).to eq("fa" => system_fa, "en" => system_en, "fr" => system_fa)
  end

  it "drops defaults when their template is deleted" do
    template = org_template("en")
    create(:report_default, organization: organization, report_template: template)

    template.destroy!

    expect(ReportDefault.count).to eq(0)
    expect(resolver.default_template).to eq(system_fa)
  end
end
