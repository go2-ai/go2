require "rails_helper"

RSpec.describe "ReportTemplates API", type: :request do
  let(:organization) { create(:organization) }
  let(:other_organization) { create(:organization) }
  let(:user) { create(:user) }
  let!(:member) { create(:member, organization: organization, user: user) }
  let!(:system_template) { create(:report_template, is_default: true) }
  let(:base_path) { "/organizations/#{organization.id}/report_templates" }

  before { sign_in(user) }

  def grant_admin
    create(:permission, code: Permission::ORG_ADMIN, grantee: member, organization: organization)
  end

  describe "GET index" do
    it "lists system and own templates without template_file" do
      own = create(:report_template, organization: organization)
      create(:report_template, organization: other_organization)

      get base_path, as: :json

      expect(response).to have_http_status(:ok)
      ids = response.parsed_body.map { |t| t["id"] }
      expect(ids).to contain_exactly(system_template.id, own.id)
      expect(response.parsed_body.first).not_to have_key("template_file")
    end

    it "tells admins which templates they can change" do
      grant_admin
      own = create(:report_template, organization: organization)

      get base_path, as: :json

      by_id = response.parsed_body.index_by { |t| t["id"] }
      expect(by_id[own.id]).to include("editable" => true, "copyable" => true)
      expect(by_id[system_template.id]).to include("editable" => false, "copyable" => true)
    end

    it "marks templates read-only for members without the admin permission" do
      get base_path, as: :json

      expect(response.parsed_body).to all(include("editable" => false, "copyable" => false))
    end

    it "is forbidden for users who are not members" do
      get "/organizations/#{other_organization.id}/report_templates", as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "GET show" do
    it "returns the template with its content" do
      get "#{base_path}/#{system_template.id}", as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["template_file"]).to eq(system_template.template_file)
    end

    it "does not expose other organizations' templates" do
      foreign = create(:report_template, organization: other_organization)

      get "#{base_path}/#{foreign.id}", as: :json

      expect(response).to have_http_status(:not_found)
    end
  end

  describe "POST create" do
    it "copies the source template" do
      grant_admin

      post base_path, params: { parent_template_id: system_template.id, template_file: "ignored" }, as: :json

      expect(response).to have_http_status(:ok)
      copy = ReportTemplate.find(response.parsed_body["id"])
      expect(copy.organization).to eq(organization)
      expect(copy.parent_template).to eq(system_template)
      expect(copy.template_file).to eq(system_template.template_file)
      expect(copy.report_key).to eq(system_template.report_key)
      expect(copy.read_attribute(:name)).to include("en" => "Journal Entry (Copy)", "fa" => "سند حسابداری (کپی)")
      expect(copy.created_by).to eq(member)
    end

    it "requires a source template" do
      grant_admin

      post base_path, params: { report_key: "journal_entry" }, as: :json

      expect(response).to have_http_status(:not_found)
    end

    it "is forbidden without the admin permission" do
      post base_path, params: { parent_template_id: system_template.id }, as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "PATCH update" do
    let(:own) { create(:report_template, organization: organization) }

    it "updates the content and merges translated names" do
      grant_admin
      new_file = { schemaVersion: 1, name: "Changed", unit: "mm", page: { size: "A4" }, dataSources: [], body: [] }.to_json

      patch "#{base_path}/#{own.id}", params: { template_file: new_file, name: { en: "Renamed" } }, as: :json

      expect(response).to have_http_status(:ok)
      own.reload
      expect(own.template_file).to eq(new_file)
      expect(own.read_attribute(:name)).to include("en" => "Renamed", "fa" => "سند حسابداری")
    end

    it "rejects content that is not a JSON object" do
      grant_admin

      patch "#{base_path}/#{own.id}", params: { template_file: "<xml/>" }, as: :json

      expect(response).to have_http_status(:unprocessable_content)
    end

    it "does not allow changing system templates" do
      grant_admin

      patch "#{base_path}/#{system_template.id}", params: { is_default: false }, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(system_template.reload.is_default).to be(true)
    end

    it "is forbidden without the admin permission" do
      patch "#{base_path}/#{own.id}", params: { is_default: true }, as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "DELETE destroy" do
    it "deletes own templates" do
      grant_admin
      own = create(:report_template, organization: organization)

      delete "#{base_path}/#{own.id}", as: :json

      expect(response).to have_http_status(:no_content)
      expect(ReportTemplate.exists?(own.id)).to be(false)
    end

    it "does not allow deleting system templates" do
      grant_admin

      delete "#{base_path}/#{system_template.id}", as: :json

      expect(response).to have_http_status(:forbidden)
      expect(ReportTemplate.exists?(system_template.id)).to be(true)
    end
  end
end
