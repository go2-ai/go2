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
    center_levels: { type: :integer, example: 3 },
    closing_method: { type: :string, enum: %w[direct income_summary current_year_profit], example: 'direct' },
    retained_earnings_account_id: { type: %i[integer null] },
    income_summary_account_id: { type: %i[integer null] },
    current_year_profit_account_id: { type: %i[integer null] },
    default_fx_gain_account_id: { type: %i[integer null] },
    default_fx_loss_account_id: { type: %i[integer null] },
    revaluation_line_description_template: { type: :object, description: '{ locale => template } for revalued balance lines' },
    revaluation_counter_line_description_template: { type: :object, description: '{ locale => template } for gain/loss lines' },
    closing_line_description_templates: { type: :object, description: '{ kind => { locale => template } } for closing entry lines' },
    closing_configuration_errors: { type: :array, items: { type: :string },
                                    description: 'What is missing to close a fiscal year' }
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
              use_parent_org_accounts: { type: :boolean, example: true },
              revaluation_line_description_template: { type: :object, example: { en: 'Revaluation of {account_name}' } },
              revaluation_counter_line_description_template: { type: :object, example: { en: 'FX {difference}' } },
              closing_line_description_templates: {
                type: :object, description: 'Kinds: closing, closing_offset, ending, beginning',
                example: { ending: { en: 'Ending balance of {account_name}' } }
              }
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

      response '200', 'Configures the closing method and FX accounts' do
        schema type: :object, properties: setting_attributes
        let(:organization_id) { organization.id }
        let(:retained_earnings) { create_account_in(organization, 'OE', ledger_code: '30') }
        let(:fx_gain) { create_account_in(organization, 'RE', ledger_code: '90') }
        let(:params) do
          { accounting_setting: { closing_method: 'income_summary', retained_earnings_account_id: retained_earnings.id,
                                  default_fx_gain_account_id: fx_gain.id } }
        end

        before { create(:permission, code: Permission::ACCOUNTING_MANAGE_SETTINGS, grantee: member, organization:) }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to include('closing_method' => 'income_summary', 'retained_earnings_account_id' => retained_earnings.id,
                                  'default_fx_gain_account_id' => fx_gain.id)
          expect(data['closing_configuration_errors']).to eq(
            [ 'Income summary account is required to close through income summary' ]
          )
        end
      end

      response '422', 'Invalid closing account' do
        let(:organization_id) { organization.id }
        let(:bank) { create_account_in(organization, 'CA', ledger_code: '10', monetary: true) }
        let(:params) { { accounting_setting: { retained_earnings_account_id: bank.id } } }

        before { create(:permission, code: Permission::ACCOUNTING_MANAGE_SETTINGS, grantee: member, organization:) }

        run_test! do |response|
          expect(JSON.parse(response.body)['errors']).to all(be_a(String))
          expect(JSON.parse(response.body)['errors'].join).to include("owners' equity")
        end
      end

      response '200', 'Sets the line description templates' do
        schema type: :object, properties: setting_attributes
        let(:organization_id) { organization.id }
        # Unknown languages and kinds are dropped.
        let(:params) do
          { accounting_setting: {
            revaluation_line_description_template: { en: 'Revaluation of {account_name}', xx: 'ignored' },
            closing_line_description_templates: { ending: { en: 'End {account_name}' }, sometimes: { en: 'ignored' } }
          } }
        end

        before { create(:permission, code: Permission::ACCOUNTING_MANAGE_SETTINGS, grantee: member, organization:) }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['revaluation_line_description_template']).to eq('en' => 'Revaluation of {account_name}')
          expect(data['closing_line_description_templates']).to eq('ending' => { 'en' => 'End {account_name}' })
        end
      end

      response '422', 'Unknown closing method' do
        let(:organization_id) { organization.id }
        let(:params) { { accounting_setting: { closing_method: 'sometimes' } } }

        before { create(:permission, code: Permission::ACCOUNTING_MANAGE_SETTINGS, grantee: member, organization:) }

        run_test! do |response|
          expect(JSON.parse(response.body)['errors']).to be_present
        end
      end

      response '422', 'Unknown template variable' do
        let(:organization_id) { organization.id }
        let(:params) { { accounting_setting: { closing_line_description_templates: { ending: { en: 'End {rate}' } } } } }

        before { create(:permission, code: Permission::ACCOUNTING_MANAGE_SETTINGS, grantee: member, organization:) }

        run_test! do |response|
          expect(JSON.parse(response.body)['errors'].join).to include('{rate}')
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
