require 'swagger_helper'

RSpec.describe 'Accounting::Currencies API', openapi_spec: 'v1/accounting.yaml', type: :request do
  currency_attributes = {
    id: { type: :integer, example: 1 },
    abr: { type: :string, example: 'USD' },
    decimal_digits: { type: :integer, example: 2 },
    organization_id: { type: :integer, example: 1 },
    created_at: { type: :string, example: '2026-02-20 10:52:46.787878000 +0000' },
    updated_at: { type: :string, example: '2026-02-20 10:52:46.787878000 +0000' }
  }

  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let(:member) { create(:member, organization:, user:) }
  let!(:currency_1) { organization.accounting_setting.main_currency }
  let(:currency_2) { create(:accounting_currency, organization:, abr: 'EUR') }

  before { sign_in(user) }

  path '/organizations/{organization_id}/accounting/currencies' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true

    get 'Get all organization currencies' do
      tags 'Currencies'
      produces 'application/json'

      response '200', 'Loaded successfully' do
        schema type: :array, items: { type: :object, properties: currency_attributes }
        let(:organization_id) { organization.id }
        before { currency_2 }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.map { |c| c["id"] }).to contain_exactly(currency_1.id, currency_2.id)
        end
      end
    end

    post 'Creating a new currency' do
      tags 'Currencies'
      consumes 'application/json'
      produces 'application/json'

      parameter name: :params, in: :body, schema: { type: :object, properties: {
          abr: { type: :string, example: 'GBP' },
          decimal_digits: { type: :integer, example: 2 },
          name_en: { type: :string, example: 'British Pound' },
          name_fa: { type: :string, example: 'پوند بریتانیا' }
        }
      }

      response '200', 'Creates the new currency successfully' do
        schema type: :object, properties: currency_attributes
        let(:organization_id) { organization.id }
        let(:params) { { abr: 'GBP', decimal_digits: 2, name_en: 'British Pound' } }

        before { create(:permission, code: Permission::ACCOUNTING_MANAGE_SETTINGS, grantee: member, organization:) }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to be > 0
          expect(data["abr"]).to eq("GBP")
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:params) { { abr: 'GBP', decimal_digits: 2, name_en: 'British Pound' } }

        before { member } # member without accounting permissions

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end

      response '422', 'Invalid request' do
        let(:organization_id) { organization.id }
        let(:params) { { abr: '', decimal_digits: nil } }

        before { create(:permission, code: Permission::ACCOUNTING_MANAGE_SETTINGS, grantee: member, organization:) }

        run_test! do |response|
          expect(response).to have_http_status(:unprocessable_content)
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/currencies/{id}' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer, description: 'Currency ID', required: true

    patch 'Updates the currency' do
      tags 'Currencies'
      consumes 'application/json'
      produces 'application/json'

      parameter name: :params, in: :body, schema: { type: :object, properties: {
          abr: { type: :string, example: 'USD' },
          decimal_digits: { type: :integer, example: 2 },
          name_en: { type: :string, example: 'Updated Name' }
        }
      }

      response '200', 'Updates the currency successfully' do
        schema type: :object, properties: currency_attributes
        let(:organization_id) { organization.id }
        let(:id) { currency_1.id }
        let(:params) { { decimal_digits: 4 } }

        before { create(:permission, code: Permission::ACCOUNTING_MANAGE_SETTINGS, grantee: member, organization:) }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to eq(currency_1.id)
          expect(data["decimal_digits"]).to eq(4)
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:id) { currency_1.id }
        let(:params) { { decimal_digits: 4 } }

        before { member }

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end

    delete 'Deletes the currency' do
      tags 'Currencies'
      produces 'application/json'

      response '200', 'Deletes the currency successfully' do
        schema type: :object, properties: currency_attributes
        let(:organization_id) { organization.id }
        let(:id) { currency_1.id }

        before { create(:permission, code: Permission::ACCOUNTING_MANAGE_SETTINGS, grantee: member, organization:) }

        run_test! do |response|
          expect(Accounting::Currency.find_by(id: currency_1.id)).to be_nil
        end
      end
    end
  end
end
