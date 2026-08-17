# spec/requests/accounting/accounts_controller_spec.rb
require "swagger_helper"

RSpec.describe "Accounting::Accounts API", openapi_spec: "v1/accounting.yaml", type: :request do
  account_attributes = {
    id: { type: :integer, example: 1 },
    code: { type: :string, example: "03" },
    name: { type: :string, example: "Cash Account" },
    contra_for_id: { type: %i[integer nil], example: nil },
    accepts_other_currencies: { type: :boolean, example: false },
    t: { type: :object, example: { name: { en: "Cash Account", fa: "حساب نقد" } } },
    allowed_center_types_1: { type: %i[array nil], example: nil },
    allowed_center_types_2: { type: %i[array nil], example: nil },
    allowed_center_types_3: { type: %i[array nil], example: nil },
    allowed_center_types_4: { type: %i[array nil], example: nil },
    allowed_center_types_5: { type: %i[array nil], example: nil },
    allowed_center_types_6: { type: %i[array nil], example: nil }
  }

  let(:organization) { create(:organization, active_locales: [:fa]) }
  let(:user) { create(:user) }
  let(:member) { create(:member, organization: organization, user: user) }
  let(:account_category) { organization.account_categories.find_by!(identifier: "CA") }
  let(:ledger) { create(:accounting_ledger, account_category: account_category, code: "10") }
  let!(:account_1) { create(:accounting_account, ledger: ledger, code: "01") }
  let(:account_2) { create(:accounting_account, ledger: ledger, code: "02") }

  before { sign_in(user) }

  path "/organizations/{organization_id}/accounting/accounts" do
    parameter name: :organization_id, in: :path, type: :integer, description: "Organization ID", required: true

    get "Get all organization accounts" do
      tags "Accounts"
      produces "application/json"

      response "200", "Loaded successfully" do
        schema type: :array, items: { type: :object, properties: account_attributes }
        let(:organization_id) { organization.id }

        before do
          create(
            :permission,
            code: Permission::ACCOUNTING_VIEW_ACCOUNTS,
            grantee: member,
            organization: organization
          )
          account_2
        end

        run_test! do |response|
          data = JSON.parse(response.body)

          expect(data.length).to eq(2)
          expect(data.map { |account| account["id"] }).to contain_exactly(account_1.id, account_2.id)
        end
      end

      response "403", "Not authorized" do
        let(:organization_id) { organization.id }

        before { member }

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end

    post "Creating a new account" do
      tags "Accounts"
      consumes "application/json"
      produces "application/json"

      parameter name: :params, in: :body, schema: {
        type: :object,
        properties: {
          ledger_id: { type: :integer, example: 1 },
          code: { type: :string, example: "12" },
          name_en: { type: :string, example: "Accounts Receivable" },
          name_fa: { type: :string, example: "حساب های دریافتنی" },
          accepts_other_currencies: { type: :boolean, example: false }
        }
      }

      response "200", "Creates the new account successfully" do
        schema type: :object, properties: account_attributes
        let(:organization_id) { organization.id }
        let(:params) do
          {
            ledger_id: ledger.id,
            code: "12",
            name_en: "Accounts Receivable",
            name_fa: "حساب های دریافتنی",
            accepts_other_currencies: false
          }
        end

        before do
          create(
            :permission,
            code: Permission::ACCOUNTING_MANAGE_ACCOUNTS,
            grantee: member,
            organization: organization
          )
        end

        run_test! do |response|
          data = JSON.parse(response.body)

          expect(data["id"]).to be > 0
          expect(data["code"]).to eq("12")
          expect(data["name"]).to eq("Accounts Receivable")
          expect(data["t"]["name"]).to include("en" => "Accounts Receivable", "fa" => "حساب های دریافتنی")
          expect(data["accepts_other_currencies"]).to be(false)
        end
      end

      response "403", "Not authorized" do
        let(:organization_id) { organization.id }
        let(:params) { { ledger_id: ledger.id, code: "12", name_en: "Test" } }

        before { member }

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end

      response "422", "Invalid request" do
        let(:organization_id) { organization.id }
        let(:params) { { ledger_id: ledger.id, code: "", name_en: "Test" } }

        before do
          create(
            :permission,
            code: Permission::ACCOUNTING_MANAGE_ACCOUNTS,
            grantee: member,
            organization: organization
          )
        end

        run_test! do |response|
          expect(response).to have_http_status(:unprocessable_content)
        end
      end
    end
  end

  path "/organizations/{organization_id}/accounting/accounts/{id}" do
    parameter name: :organization_id, in: :path, type: :integer, description: "Organization ID", required: true
    parameter name: :id, in: :path, type: :integer, description: "Account ID", required: true

    get "Get the account" do
      tags "Accounts"
      produces "application/json"

      response "200", "Loaded successfully" do
        schema type: :object, properties: account_attributes
        let(:organization_id) { organization.id }
        let(:id) { account_1.id }

        before do
          create(
            :permission,
            code: Permission::ACCOUNTING_VIEW_ACCOUNTS,
            grantee: member,
            organization: organization
          )
        end

        run_test! do |response|
          data = JSON.parse(response.body)

          expect(data["id"]).to eq(account_1.id)
          expect(data["code"]).to eq(account_1.code)
          expect(data["name"]).to eq(account_1.name)
          expect(data).to include(
            "accepts_other_currencies",
            "allowed_center_types_1",
            "allowed_center_types_2",
            "allowed_center_types_3",
            "allowed_center_types_4",
            "allowed_center_types_5",
            "allowed_center_types_6"
          )
        end
      end

      response "403", "Not authorized" do
        let(:organization_id) { organization.id }
        let(:id) { account_1.id }

        before { member }

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end

      response "404", "Not found" do
        let(:organization_id) { organization.id }
        let(:id) { 99999 }

        before do
          create(
            :permission,
            code: Permission::ACCOUNTING_VIEW_ACCOUNTS,
            grantee: member,
            organization: organization
          )
        end

        run_test! do |response|
          expect(response).to have_http_status(:not_found)
        end
      end

      response "404", "Account belongs to another organization" do
        let(:other_organization) { create(:organization) }
        let(:other_category) { other_organization.account_categories.find_by!(identifier: "CA") }
        let(:other_ledger) { create(:accounting_ledger, account_category: other_category, code: "12") }
        let!(:other_account) { create(:accounting_account, ledger: other_ledger, code: "13") }
        let(:organization_id) { organization.id }
        let(:id) { other_account.id }

        before do
          create(
            :permission,
            code: Permission::ACCOUNTING_VIEW_ACCOUNTS,
            grantee: member,
            organization: organization
          )
        end

        run_test! do |response|
          expect(response).to have_http_status(:not_found)
        end
      end
    end

    patch "Updates the account" do
      tags "Accounts"
      consumes "application/json"
      produces "application/json"

      parameter name: :params, in: :body, schema: {
        type: :object,
        properties: {
          code: { type: :string, example: "13" },
          name_en: { type: :string, example: "Updated Account" },
          accepts_other_currencies: { type: :boolean, example: true }
        }
      }

      response "200", "Updates the account successfully" do
        schema type: :object, properties: account_attributes
        let(:organization_id) { organization.id }
        let(:id) { account_1.id }
        let(:params) { { code: "13", name_en: "Updated Account", accepts_other_currencies: true } }

        before do
          create(
            :permission,
            code: Permission::ACCOUNTING_MANAGE_ACCOUNTS,
            grantee: member,
            organization: organization
          )
        end

        run_test! do |response|
          data = JSON.parse(response.body)

          expect(data["id"]).to eq(account_1.id)
          expect(data["code"]).to eq("13")
          expect(data["name"]).to eq("Updated Account")
          expect(data["accepts_other_currencies"]).to be(true)
        end
      end

      response "403", "Not authorized" do
        let(:organization_id) { organization.id }
        let(:id) { account_1.id }
        let(:params) { { code: "13" } }

        before { member }

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end

      response "404", "Account belongs to another organization" do
        let(:other_organization) { create(:organization) }
        let(:other_category) { other_organization.account_categories.find_by!(identifier: "CA") }
        let(:other_ledger) { create(:accounting_ledger, account_category: other_category, code: "12") }
        let!(:other_account) { create(:accounting_account, ledger: other_ledger, code: "13") }
        let(:organization_id) { organization.id }
        let(:id) { other_account.id }
        let(:params) { { code: "13" } }

        before do
          create(
            :permission,
            code: Permission::ACCOUNTING_MANAGE_ACCOUNTS,
            grantee: member,
            organization: organization
          )
        end

        run_test! do |response|
          expect(response).to have_http_status(:not_found)
        end
      end
    end

    delete "Deletes the account" do
      tags "Accounts"
      produces "application/json"

      response "200", "Deletes the account successfully" do
        schema type: :object, properties: account_attributes
        let(:organization_id) { organization.id }
        let(:id) { account_1.id }

        before do
          create(
            :permission,
            code: Permission::ACCOUNTING_MANAGE_ACCOUNTS,
            grantee: member,
            organization: organization
          )
        end

        run_test! do |response|
          expect(response).to have_http_status(:ok)
          expect(Accounting::Account.find_by(id: account_1.id)).to be_nil
        end
      end

      response "403", "Not authorized" do
        let(:organization_id) { organization.id }
        let(:id) { account_1.id }

        before { member }

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end

      response "404", "Account belongs to another organization" do
        let(:other_organization) { create(:organization) }
        let(:other_category) { other_organization.account_categories.find_by!(identifier: "CA") }
        let(:other_ledger) { create(:accounting_ledger, account_category: other_category, code: "12") }
        let!(:other_account) { create(:accounting_account, ledger: other_ledger, code: "13") }
        let(:organization_id) { organization.id }
        let(:id) { other_account.id }

        before do
          create(
            :permission,
            code: Permission::ACCOUNTING_MANAGE_ACCOUNTS,
            grantee: member,
            organization: organization
          )
        end

        run_test! do |response|
          expect(response).to have_http_status(:not_found)
        end
      end
    end
  end
end