require "rails_helper"

RSpec.describe "ReportDefaults API", type: :request do
  let(:organization) { persian_organization(active_locales: [ "en" ]) }
  let(:user) { create(:user) }
  let!(:member) { create(:member, name: "Member", organization: organization, user: user) }
  let!(:system_en) { create(:report_template, locale: "en") }
  let!(:system_fa) { create(:report_template, locale: "fa") }
  let(:path) { "/organizations/#{organization.id}/report_defaults" }

  before { sign_in(user) }

  def grant(code)
    create(:permission, code: code, grantee: member, organization: organization)
  end

  def grant_print
    grant(Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES)
  end

  def grant_manage
    grant_print
    grant(Permission::REPORTS_MANAGE_JOURNAL_ENTRY)
  end

  describe "GET show" do
    it "resolves the templates of a report" do
      grant_print

      get path, params: { report_key: "journal_entry" }, as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to include(
        "report_key" => "journal_entry",
        "default_template_id" => system_fa.id,
        "organization_default_template_id" => nil,
        "personal_default_template_id" => nil,
        "can_manage" => false,
        "can_print" => true
      )
      expect(response.parsed_body["locales"]).to eq([
        { "locale" => "fa", "template_id" => system_fa.id, "template_locale" => "fa",
          "system_template_id" => system_fa.id, "system_template_locale" => "fa" },
        { "locale" => "en", "template_id" => system_en.id, "template_locale" => "en",
          "system_template_id" => system_en.id, "system_template_locale" => "en" }
      ])
    end

    it "is forbidden without permission to print the report" do
      get path, params: { report_key: "journal_entry" }, as: :json

      expect(response).to have_http_status(:forbidden)
    end

    it "rejects unknown reports" do
      grant_print

      get path, params: { report_key: "unknown" }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "PUT update" do
    it "sets the organization default for report managers" do
      grant_manage

      put path, params: { report_key: "journal_entry", report_template_id: system_en.id, scope: "organization" }, as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to include("default_template_id" => system_en.id,
                                              "organization_default_template_id" => system_en.id)
      expect(ReportDefault.find_by(organization: organization, member: nil).report_template).to eq(system_en)
    end

    it "replaces the previous organization default" do
      grant_manage
      create(:report_default, organization: organization, report_template: system_fa)

      put path, params: { report_key: "journal_entry", report_template_id: system_en.id, scope: "organization" }, as: :json

      expect(ReportDefault.where(organization: organization, member: nil).pluck(:report_template_id)).to eq([ system_en.id ])
    end

    it "does not let members who only print set the organization default" do
      grant_print

      put path, params: { report_key: "journal_entry", report_template_id: system_en.id, scope: "organization" }, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(ReportDefault.count).to eq(0)
    end

    it "lets members who print set their own default, which wins over the organization's" do
      grant_print
      create(:report_default, organization: organization, report_template: system_fa)

      put path, params: { report_key: "journal_entry", report_template_id: system_en.id, scope: "personal" }, as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to include("default_template_id" => system_en.id,
                                              "personal_default_template_id" => system_en.id,
                                              "organization_default_template_id" => system_fa.id)
      expect(ReportDefault.find_by(member: member).report_template).to eq(system_en)
    end

    it "rejects templates of other organizations or reports" do
      grant_manage
      foreign = create(:report_template, organization: create(:organization))
      revaluation = create(:report_template, report_key: "currency_revaluation")

      [ foreign, revaluation ].each do |template|
        put path, params: { report_key: "journal_entry", report_template_id: template.id, scope: "personal" }, as: :json

        expect(response).to have_http_status(:not_found)
      end
    end

    it "rejects unknown scopes" do
      grant_manage

      put path, params: { report_key: "journal_entry", report_template_id: system_en.id, scope: "global" }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "DELETE destroy" do
    it "clears the member's own default only" do
      grant_print
      create(:report_default, organization: organization, report_template: system_en)
      create(:report_default, organization: organization, member: member, report_template: system_fa)

      delete path, params: { report_key: "journal_entry", scope: "personal" }, as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to include("default_template_id" => system_en.id, "personal_default_template_id" => nil)
      expect(ReportDefault.where(member: member)).to be_empty
    end

    it "clears the organization default for report managers" do
      grant_manage
      create(:report_default, organization: organization, report_template: system_en)

      delete path, params: { report_key: "journal_entry", scope: "organization" }, as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to include("default_template_id" => system_fa.id)
      expect(ReportDefault.count).to eq(0)
    end

    it "does not let members who only print clear the organization default" do
      grant_print
      create(:report_default, organization: organization, report_template: system_en)

      delete path, params: { report_key: "journal_entry", scope: "organization" }, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(ReportDefault.count).to eq(1)
    end
  end
end
