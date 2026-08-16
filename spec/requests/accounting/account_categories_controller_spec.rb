# spec/requests/accounting/account_categories_controller_spec.rb
require 'swagger_helper'

RSpec.describe 'Accounting::AccountCategories API', openapi_spec: 'v1/accounting.yaml', type: :request do
  account_category_attributes = {
    id: { type: :integer, example: 1 },
    code: { type: :string, example: '50' },
    identifier: { type: %i[string nil], example: nil },
    type: { type: :string, example: 'other' },
    name: { type: :string, example: 'Custom Category' },
    t: { type: :object, example: { name: { en: 'Custom Category', fa: 'دسته سفارشی' } } },
    ledgers_count: { type: :integer, example: 0, description: 'Only in index view' }
  }

  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let(:member) { create(:member, organization: organization, user: user) }
  let!(:system_category) { organization.account_categories.find_by!(identifier: "CA") }

  before { sign_in(user) }

  path '/organizations/{organization_id}/accounting/account_categories' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true

    get 'Get all organization account categories' do
      tags 'Account Categories'
      produces 'application/json'

      response '200', 'Loaded successfully' do
        schema type: :array, items: { type: :object, properties: account_category_attributes }
        let(:organization_id) { organization.id }

        before do
          create(:permission, code: Permission::ACCOUNTING_VIEW_ACCOUNTS, grantee: member, organization: organization)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.length).to eq(9) # 9 system categories
          expect(data.map { |c| c["identifier"] }).to include("CA")
          expect(data.first).to have_key("ledgers_count")
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

    post 'Creating a new account category' do
      tags 'Account Categories'
      consumes 'application/json'
      produces 'application/json'

      parameter name: :params, in: :body, schema: {
        type: :object,
        properties: {
          code: { type: :string, example: '50' },
          name_en: { type: :string, example: 'Custom Category' },
          name_fa: { type: :string, example: 'دسته سفارشی' }
        }
      }

      response '200', 'Creates the new account category successfully' do
        schema type: :object, properties: account_category_attributes
        let(:organization_id) { organization.id }
        let(:params) { { code: '50', name_en: 'Custom Category', name_fa: 'دسته سفارشی', type: :other } }

        before do
          create(:permission, code: Permission::ACCOUNTING_MANAGE_ACCOUNTS, grantee: member, organization: organization)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to be > 0
          expect(data['code']).to eq('50')
          expect(data['identifier']).to be_nil
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:params) { { code: '50', name_en: 'Test' } }

        before { member }

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end

      response '422', 'Invalid request' do
        let(:organization_id) { organization.id }
        let(:params) { { code: '', name_en: 'Test' } }

        before do
          create(:permission, code: Permission::ACCOUNTING_MANAGE_ACCOUNTS, grantee: member, organization: organization)
        end

        run_test! do |response|
          expect(response).to have_http_status(:unprocessable_content)
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/account_categories/{id}' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer, description: 'Account Category ID', required: true

    get 'Shows account category' do
      tags 'Account Categories'
      consumes 'application/json'
      produces 'application/json'

      response '200', 'Returns the account category successfully' do
        schema type: :object, properties: account_category_attributes
        let(:organization_id) { organization.id }
        let(:id) { system_category.id }

        before do
          create(:permission, code: Permission::ACCOUNTING_VIEW_ACCOUNTS, grantee: member, organization: organization)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to eq(system_category.id)
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:id) { system_category.id }

        before { member }

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end

    patch 'Updates the account category' do
      tags 'Account Categories'
      consumes 'application/json'
      produces 'application/json'

      parameter name: :params, in: :body, schema: {
        type: :object,
        properties: {
          code: { type: :string, example: '51' },
          name_en: { type: :string, example: 'Updated Category' }
        }
      }

      response '200', 'Updates the account category successfully' do
        schema type: :object, properties: account_category_attributes
        let(:organization_id) { organization.id }
        let(:id) { system_category.id }
        let(:params) { { code: '51' } }

        before do
          create(:permission, code: Permission::ACCOUNTING_MANAGE_ACCOUNTS, grantee: member, organization: organization)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to eq(system_category.id)
          expect(data['code']).to eq('51')
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:id) { system_category.id }
        let(:params) { { code: '51' } }

        before { member }

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end

    delete 'Deletes the account category' do
      tags 'Account Categories'
      produces 'application/json'

      response '200', 'Deletes the account category successfully' do
        let(:organization_id) { organization.id }
        let!(:user_category) do
          create(:accounting_account_category, organization: organization,
                 code: "50#{rand(100..999)}", name: { en: 'Custom Category' }, type: :other)
        end
        let(:id) { user_category.id }

        before do
          create(:permission, code: Permission::ACCOUNTING_MANAGE_ACCOUNTS, grantee: member, organization: organization)
        end

        run_test! do |response|
          expect(Accounting::AccountCategory.find_by(id: user_category.id)).to be_nil
        end
      end
    end
  end
end