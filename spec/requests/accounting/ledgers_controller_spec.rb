# spec/requests/accounting/ledgers_controller_spec.rb
require 'swagger_helper'

RSpec.describe 'Accounting::Ledgers API', openapi_spec: 'v1/accounting.yaml', type: :request do
  ledger_attributes = {
    id: { type: :integer, example: 1 },
    code: { type: :string, example: '10' },
    name: { type: :string, example: 'Cash' },
    unexpected_balance: { type: :string, example: 'accept' },
    is_monetary: { type: :boolean, example: false },
    contra_for_id: { type: %i[integer nil], example: nil },
    t: { type: :object, example: { name: { en: 'Cash', fa: 'نقد' } } },
    account_category: { type: :object, example: { id: 1, code: '1', identifier: 'CA' } }
  }

  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let(:member) { create(:member, organization: organization, user: user) }
  let(:account_category) { organization.account_categories.find_by!(identifier: "CA") }
  let!(:ledger_1) { create(:accounting_ledger, account_category: account_category, code: "10") }
  let(:ledger_2) { create(:accounting_ledger, account_category: account_category, code: "11") }

  before { sign_in(user) }

  path '/organizations/{organization_id}/accounting/ledgers' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true

    get 'Get all organization ledgers' do
      tags 'Ledgers'
      produces 'application/json'

      response '200', 'Loaded successfully' do
        schema type: :array, items: { type: :object, properties: ledger_attributes }
        let(:organization_id) { organization.id }

        before do
          create(:permission, code: Permission::ACCOUNTING_VIEW_ACCOUNTS, grantee: member, organization: organization)
          ledger_2
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.length).to eq(2)
          expect(data.map { |l| l["id"] }).to contain_exactly(ledger_1.id, ledger_2.id)
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }

        before { member }

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end

    post 'Creating a new ledger' do
      tags 'Ledgers'
      consumes 'application/json'
      produces 'application/json'

      parameter name: :params, in: :body, schema: {
        type: :object,
        properties: {
          account_category_id: { type: :integer, example: 1 },
          code: { type: :string, example: '12' },
          name_en: { type: :string, example: 'Accounts Receivable' },
          name_fa: { type: :string, example: 'حساب های دریافتنی' },
          unexpected_balance: { type: :string, example: 'accept' },
          is_monetary: { type: :boolean, example: false }
        }
      }

      response '200', 'Creates the new ledger successfully' do
        schema type: :object, properties: ledger_attributes
        let(:organization_id) { organization.id }
        let(:params) { {
          account_category_id: account_category.id,
          code: '12',
          name_en: 'Accounts Receivable',
          name_fa: 'حساب های دریافتنی',
          unexpected_balance: 'accept',
          is_monetary: false
        } }

        before do
          create(:permission, code: Permission::ACCOUNTING_MANAGE_ACCOUNTS, grantee: member, organization: organization)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to be > 0
          expect(data['code']).to eq('12')
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:params) { { account_category_id: account_category.id, code: '12', name_en: 'Test' } }

        before { member }

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end

      response '422', 'Invalid request' do
        let(:organization_id) { organization.id }
        let(:params) { { account_category_id: account_category.id, code: '', name_en: 'Test' } }

        before do
          create(:permission, code: Permission::ACCOUNTING_MANAGE_ACCOUNTS, grantee: member, organization: organization)
        end

        run_test! do |response|
          expect(response).to have_http_status(:unprocessable_content)
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/ledgers/{id}' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer, description: 'Ledger ID', required: true

    get 'Get the ledger' do
      tags 'Ledgers'
      produces 'application/json'

      response '200', 'Loaded successfully' do
        schema type: :object, properties: ledger_attributes
        let(:organization_id) { organization.id }
        let(:id) { ledger_1.id }

        before do
          create(:permission, code: Permission::ACCOUNTING_VIEW_ACCOUNTS, grantee: member, organization: organization)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to eq(ledger_1.id)
          expect(data).to have_key('balance_type')
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:id) { ledger_1.id }

        before { member }

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end

      response '404', 'Not found' do
        let(:organization_id) { organization.id }
        let(:id) { 99999 }

        before do
          create(:permission, code: Permission::ACCOUNTING_VIEW_ACCOUNTS, grantee: member, organization: organization)
        end

        run_test! do |response|
          expect(response).to have_http_status(:not_found)
        end
      end
    end

    patch 'Updates the ledger' do
      tags 'Ledgers'
      consumes 'application/json'
      produces 'application/json'

      parameter name: :params, in: :body, schema: {
        type: :object,
        properties: {
          code: { type: :string, example: '13' },
          name_en: { type: :string, example: 'Updated Ledger' },
          is_monetary: { type: :boolean, example: true }
        }
      }

      response '200', 'Updates the ledger successfully' do
        schema type: :object, properties: ledger_attributes
        let(:organization_id) { organization.id }
        let(:id) { ledger_1.id }
        let(:params) { { code: '13', name_en: 'Updated Ledger' } }

        before do
          create(:permission, code: Permission::ACCOUNTING_MANAGE_ACCOUNTS, grantee: member, organization: organization)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to eq(ledger_1.id)
          expect(data['code']).to eq('13')
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:id) { ledger_1.id }
        let(:params) { { code: '13' } }

        before { member }

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end

    delete 'Deletes the ledger' do
      tags 'Ledgers'
      produces 'application/json'

      response '200', 'Deletes the ledger successfully' do
        let(:organization_id) { organization.id }
        let(:id) { ledger_1.id }

        before do
          create(:permission, code: Permission::ACCOUNTING_MANAGE_ACCOUNTS, grantee: member, organization: organization)
        end

        run_test! do |response|
          expect(Accounting::Ledger.find_by(id: ledger_1.id)).to be_nil
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:id) { ledger_1.id }

        before { member }

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end
  end
end