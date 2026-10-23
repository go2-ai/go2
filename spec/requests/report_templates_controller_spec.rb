require "rails_helper"

RSpec.describe "ReportTemplates API", type: :request do
  let(:organization) { create(:organization, active_locales: [ "fa" ]) }
  let(:other_organization) { create(:organization) }
  let(:user) { create(:user) }
  let!(:member) { create(:member, organization: organization, user: user) }
  let!(:system_template) { create(:report_template) }
  let(:base_path) { "/organizations/#{organization.id}/report_templates" }

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

  describe "GET index" do
    it "lists system and own templates without template_file" do
      grant_print
      own = create(:report_template, organization: organization)
      create(:report_template, organization: other_organization)

      get base_path, as: :json

      expect(response).to have_http_status(:ok)
      ids = response.parsed_body.map { |t| t["id"] }
      expect(ids).to contain_exactly(system_template.id, own.id)
      expect(response.parsed_body.first).not_to have_key("template_file")
      expect(response.parsed_body.first).to include("locale" => "en")
    end

    it "only lists reports the member may print" do
      grant(Permission::ACCOUNTING_REVALUE_CURRENCIES)
      revaluation = create(:report_template, report_key: "currency_revaluation")

      get base_path, as: :json

      expect(response.parsed_body.map { |t| t["id"] }).to eq([ revaluation.id ])
    end

    it "lists nothing to members who may print no report" do
      create(:report_template, organization: organization)

      get base_path, as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq([])
    end

    it "tells report managers which templates they can change" do
      grant_manage
      own = create(:report_template, organization: organization)

      get base_path, as: :json

      by_id = response.parsed_body.index_by { |t| t["id"] }
      expect(by_id[own.id]).to include("editable" => true, "copyable" => true)
      expect(by_id[system_template.id]).to include("editable" => false, "copyable" => true)
    end

    it "gives management rights per report" do
      grant(Permission::REPORTS_MANAGE_JOURNAL_ENTRY)
      grant(Permission::ACCOUNTING_REVALUE_CURRENCIES)
      revaluation = create(:report_template, report_key: "currency_revaluation", organization: organization)
      own = create(:report_template, organization: organization)

      get base_path, as: :json

      by_id = response.parsed_body.index_by { |t| t["id"] }
      expect(by_id[own.id]).to include("editable" => true)
      expect(by_id[revaluation.id]).to include("editable" => false, "copyable" => false)
    end

    it "does not let organization admins manage without the report's manage permission" do
      grant_print
      grant(Permission::ORG_ADMIN)
      own = create(:report_template, organization: organization)

      get base_path, as: :json

      expect(response.parsed_body.index_by { |t| t["id"] }[own.id]).to include("editable" => false, "copyable" => false)
    end

    it "marks templates read-only for members who can only print" do
      grant_print
      create(:report_template, organization: organization)

      get base_path, as: :json

      expect(response.parsed_body).to all(include("editable" => false, "copyable" => false))
    end

    it "is forbidden for users who are not members" do
      get "/organizations/#{other_organization.id}/report_templates", as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "GET show" do
    before { grant(Permission::ACCOUNTING_REVALUE_CURRENCIES) }

    it "returns the template with its content" do
      grant_print

      get "#{base_path}/#{system_template.id}", as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["template_file"]).to eq(system_template.template_file)
    end

    it "does not return templates of reports the member may not print" do
      get "#{base_path}/#{system_template.id}", as: :json

      expect(response).to have_http_status(:not_found)
    end

    it "generates the currency revaluation template for the organization's center levels and the template's locale" do
      organization.accounting_setting.update!(center_levels: 2)
      template = create(:report_template, report_key: "currency_revaluation", locale: "fa",
                                          template_file: Accounting::Reports::CurrencyRevaluationTemplate.build(center_levels: 3).to_json)

      get "#{base_path}/#{template.id}", as: :json

      titles = JSON.parse(response.parsed_body["template_file"])["body"][0]["header"]["components"].map { |c| c["text"] }
      expect(titles).to include("مرکز 2")
      expect(titles).not_to include("مرکز 3")
    end

    it "does not expose other organizations' templates" do
      foreign = create(:report_template, organization: other_organization)

      get "#{base_path}/#{foreign.id}", as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST create" do
    it "copies the source template" do
      grant_manage

      post base_path, params: { parent_template_id: system_template.id, template_file: "ignored" }, as: :json

      expect(response).to have_http_status(:ok)
      copy = ReportTemplate.find(response.parsed_body["id"])
      expect(copy.organization).to eq(organization)
      expect(copy.parent_template).to eq(system_template)
      expect(copy.template_file).to eq(system_template.template_file)
      expect(copy.report_key).to eq(system_template.report_key)
      expect(copy.locale).to eq("en")
      expect(copy.read_attribute(:name)).to include("en" => "Journal Entry (Copy)", "fa" => "سند حسابداری (کپی)")
      expect(copy.created_by).to eq(member)
    end

    it "copies into another of the organization's locales" do
      grant_manage

      post base_path, params: { parent_template_id: system_template.id, locale: "fa" }, as: :json

      expect(response).to have_http_status(:ok)
      expect(ReportTemplate.find(response.parsed_body["id"]).locale).to eq("fa")
    end

    it "rejects locales the organization does not use" do
      grant_manage

      post base_path, params: { parent_template_id: system_template.id, locale: "fr" }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
    end

    it "requires a source template" do
      grant_manage

      post base_path, params: { report_key: "journal_entry" }, as: :json

      expect(response).to have_http_status(:not_found)
    end

    it "is forbidden without the report's manage permission" do
      grant_print
      grant(Permission::REPORTS_MANAGE_CURRENCY_REVALUATION)

      post base_path, params: { parent_template_id: system_template.id }, as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "PATCH update" do
    let(:own) { create(:report_template, organization: organization) }

    it "updates the content and merges translated names" do
      grant_manage
      new_file = { schemaVersion: 1, name: "Changed", unit: "mm", page: { size: "A4" }, dataSources: [], body: [] }.to_json

      patch "#{base_path}/#{own.id}", params: { template_file: new_file, name: { en: "Renamed" } }, as: :json

      expect(response).to have_http_status(:ok)
      own.reload
      expect(own.template_file).to eq(new_file)
      expect(own.read_attribute(:name)).to include("en" => "Renamed", "fa" => "سند حسابداری")
    end

    it "rejects content that is not a JSON object" do
      grant_manage

      patch "#{base_path}/#{own.id}", params: { template_file: "<xml/>" }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
    end

    it "does not allow changing system templates" do
      grant_manage

      patch "#{base_path}/#{system_template.id}", params: { name: { en: "Changed" } }, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(system_template.reload.read_attribute(:name)).to include("en" => "Journal Entry")
    end

    it "is forbidden without the report's manage permission" do
      grant_print

      patch "#{base_path}/#{own.id}", params: { name: { en: "Changed" } }, as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "DELETE destroy" do
    it "deletes own templates and the defaults using them" do
      grant_manage
      own = create(:report_template, organization: organization)
      create(:report_default, organization: organization, report_template: own)

      delete "#{base_path}/#{own.id}", as: :json

      expect(response).to have_http_status(:no_content)
      expect(ReportTemplate.exists?(own.id)).to be(false)
      expect(ReportDefault.count).to eq(0)
    end

    it "does not allow deleting system templates" do
      grant_manage

      delete "#{base_path}/#{system_template.id}", as: :json

      expect(response).to have_http_status(:forbidden)
      expect(ReportTemplate.exists?(system_template.id)).to be(true)
    end
  end
end
