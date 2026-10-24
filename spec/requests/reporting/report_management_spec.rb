require "rails_helper"

RSpec.describe "Reporting report management", type: :request do
  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let!(:member) { create(:member, organization: organization, user: user) }
  let(:other_user) { create(:user) }
  let!(:other_member) { create(:member, organization: organization, user: other_user) }
  let(:base_path) { "/organizations/#{organization.id}/reporting/reports" }
  let(:bs) { Reporting::Report.system.find_by!(key: "ifrs.balance_sheet") }

  def permit(code, grantee = member)
    create(:permission, code: code, grantee: grantee, organization: organization)
  end

  before do
    Accounting::Statements::Presets::Loader.call
    sign_in(user)
  end

  describe "copy, rename, primary, archive" do
    before { permit(Permission::REPORTS_MANAGE_STATEMENTS) }

    it "copies a system report and changes the copy" do
      post "#{base_path}/#{bs.id}/copy", params: { name: { en: "Our balance sheet" } }, as: :json
      expect(response).to have_http_status(:created)
      copy = Reporting::Report.find(response.parsed_body["id"])
      expect(copy).to have_attributes(organization: organization, parent_report: bs, primary: true, created_by: member)
      expect(copy.name).to eq("Our balance sheet")

      second = Reporting::Reports::Copy.call(source: copy, organization: organization)
      patch "#{base_path}/#{second.id}", params: { primary: true, name: { en: "Second" } }, as: :json
      expect(response).to have_http_status(:ok)
      expect(second.reload).to be_primary
      expect(copy.reload).not_to be_primary

      post "#{base_path}/#{second.id}/archive", as: :json
      expect(second.reload).to be_archived
      get base_path, as: :json
      expect(response.parsed_body.map { |r| r["id"] }).not_to include(second.id)

      delete "#{base_path}/#{second.id}", as: :json
      expect(response).to have_http_status(:no_content)
    end

    it "keeps system reports read-only" do
      patch "#{base_path}/#{bs.id}", params: { name: { en: "x" } }, as: :json
      expect(response).to have_http_status(:forbidden)
      delete "#{base_path}/#{bs.id}", as: :json
      expect(response).to have_http_status(:forbidden)
    end
  end

  it "doesn't let viewers copy or change reports" do
    permit(Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES)
    post "#{base_path}/#{bs.id}/copy", as: :json
    expect(response).to have_http_status(:forbidden)
  end

  it "lets an edit grant change an organization report" do
    copy = Reporting::Reports::Copy.call(source: bs, organization: organization)
    Reporting::ReportGrant.create!(organization: organization, report: copy, grantee: member, access: :edit)

    patch "#{base_path}/#{copy.id}", params: { description: { en: "Edited" } }, as: :json
    expect(response).to have_http_status(:ok)
    expect(copy.reload.description).to eq("Edited")
  end

  describe "grants" do
    let(:copy) { Reporting::Reports::Copy.call(source: bs, organization: organization) }
    let(:role) { create(:role, organization: organization, member: other_member) }

    it "grants a role, which gives its member that report only" do
      permit(Permission::REPORTS_MANAGE_ACCESS)

      post "#{base_path}/#{copy.id}/grants", params: { grantee_type: "Role", grantee_id: role.id, access: "view" }, as: :json
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to include("grantee_type" => "Role", "access" => "view")

      get "#{base_path}/#{copy.id}/grants", as: :json
      expect(response.parsed_body.map { |g| g["grantee_name"] }).to eq([ role.name ])

      sign_in(other_user)
      get base_path, as: :json
      expect(response.parsed_body.map { |r| r["id"] }).to eq([ copy.id ])
    end

    it "grants only view access on system reports and rejects outside grantees" do
      permit(Permission::REPORTS_MANAGE_ACCESS)
      post "#{base_path}/#{bs.id}/grants", params: { grantee_type: "Member", grantee_id: other_member.id, access: "edit" }, as: :json
      expect(response.parsed_body["access"]).to eq("view")

      outsider = create(:member, organization: create(:organization), user: create(:user))
      post "#{base_path}/#{bs.id}/grants", params: { grantee_type: "Member", grantee_id: outsider.id }, as: :json
      expect(response).to have_http_status(:unprocessable_content)
      post "#{base_path}/#{bs.id}/grants", params: { grantee_type: "User", grantee_id: user.id }, as: :json
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "removes grants" do
      permit(Permission::REPORTS_MANAGE_ACCESS)
      grant = Reporting::ReportGrant.create!(organization: organization, report: copy, grantee: role)
      delete "#{base_path}/#{copy.id}/grants/#{grant.id}", as: :json
      expect(response).to have_http_status(:no_content)
      expect(Reporting::ReportGrant.exists?(grant.id)).to be false
    end

    it "requires the manage access permission" do
      permit(Permission::REPORTS_MANAGE_STATEMENTS)
      get "#{base_path}/#{copy.id}/grants", as: :json
      expect(response).to have_http_status(:forbidden)
    end
  end
end
