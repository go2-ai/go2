require 'swagger_helper'

RSpec.describe 'Accounting::Settings API', openapi_spec: 'v1/accounting.yaml', type: :request do
  setting_attributes = {
    id: { type: :integer, example: 1 },
    main_currency_id: { type: %i[integer nil], example: 1 },
    use_parent_org_currencies: { type: :boolean, example: false },
    use_parent_org_accounts: { type: :boolean, example: false },
    use_parent_org_centers: { type: :boolean, example: false },
    use_parent_org_fiscal_years: { type: :boolean, example: false },
    account_category_length: { type: :integer, example: 1 },
    ledger_length: { type: :integer, example: 2 },
    account_length: { type: :integer, example: 2 },
    center_length: { type: :integer, example: 6 },
    center_levels: { type: :integer, example: 3 }
  }

  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let(:member) { create(:member, organization:, user:) }

  before { sign_in(user) }

  path '/organizations/{organization_id}/accounting/settings' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true

    get 'Get accounting settings for the organization' do
      tags 'Settings'
      produces 'application/json'

      response '200', 'Loaded successfully' do
        schema type: :object, properties: setting_attributes
        let(:organization_id) { organization.id }

        before { create(:permission, code: Permission::ACCOUNTING_VIEW_SETTINGS, grantee: member, organization:) }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["account_category_length"]).to eq(1)
          expect(data["ledger_length"]).to eq(2)
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }

        before { member } # a member with no accounting permissions

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end

    patch 'Updates accounting settings for the organization' do
      tags 'Settings'
      consumes 'application/json'
      produces 'application/json'

      parameter name: :params, in: :body, schema: {
        type: :object,
        properties: {
          accounting_setting: {
            type: :object,
            properties: {
              main_currency_id: { type: :integer, example: 1 },
              account_length: { type: :integer, example: 3 },
              use_parent_org_accounts: { type: :boolean, example: true }
            }
          }
        }
      }

      response '200', 'Updates the settings successfully' do
        schema type: :object, properties: setting_attributes
        let(:organization_id) { organization.id }
        let(:params) { { accounting_setting: { account_length: 3 } } }

        before { create(:permission, code: Permission::ACCOUNTING_MANAGE_SETTINGS, grantee: member, organization:) }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["account_length"]).to eq(3)
        end
      end

      response '403', 'Not authorized when only holding view permission' do
        let(:organization_id) { organization.id }
        let(:params) { { accounting_setting: { account_length: 3 } } }

        before { create(:permission, code: Permission::ACCOUNTING_VIEW_SETTINGS, grantee: member, organization:) }

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end
  end
end
