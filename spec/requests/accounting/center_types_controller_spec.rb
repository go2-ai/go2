# spec/requests/accounting/center_types_controller_spec.rb
require 'swagger_helper'

RSpec.describe 'Accounting::CenterTypes API', openapi_spec: 'v1/accounting.yaml', type: :request do
  center_type_attributes = {
    id: { type: :integer, example: 1 },
    first_code: { type: :string, example: '001' },
    last_code: { type: :string, example: '010' },
    auto_increment: { type: :boolean, example: true },
    metadata: { type: :array, example: [] },
    name: { type: :string, example: 'Cost Centers' },
    t: { type: :object, example: { name: { en: 'Cost Centers', fa: 'مراکز هزینه' } } },
    organization_id: { type: :integer, example: 1 },
    created_at: { type: :string, example: '2026-02-20 10:52:46.787878000 +0000' },
    updated_at: { type: :string, example: '2026-02-20 10:52:46.787878000 +0000' }
  }

  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let(:member) { create(:member, organization: organization, user: user) }
  let!(:center_type_1) { create(:accounting_center_type, organization: organization, first_code: '001', last_code: '050', name: { en: 'Organizations' }) }
  let(:center_type_2) { create(:accounting_center_type, organization: organization, first_code: '051', last_code: '100', name: { en: 'Contracts' }) }

  before { sign_in(user) }

  path '/organizations/{organization_id}/accounting/center_types' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true

    get 'Get all organization center types' do
      tags 'Center Types'
      produces 'application/json'

      response '200', 'Loaded successfully' do
        schema type: :array, items: { type: :object, properties: center_type_attributes }
        let(:organization_id) { organization.id }
        before { center_type_2 }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.map { |c| c["id"] }).to contain_exactly(center_type_1.id, center_type_2.id)
        end
      end
    end

    post 'Creating a new center type' do
      tags 'Center Types'
      consumes 'application/json'
      produces 'application/json'

      parameter name: :params, in: :body, schema: {
        type: :object,
        properties: {
          first_code: { type: :string, example: '101' },
          last_code: { type: :string, example: '150' },
          auto_increment: { type: :boolean, example: true },
          metadata: {
            type: :array,
            items: {
              type: :object,
              properties: {
                id: { type: :string, example: 'swift_code' },
                name: { type: :object, example: { en: 'Swift Code', fa: 'کد سوئیفت' } },
                type: { type: :string, example: 'text' },
                required: { type: :boolean, example: true }
              }
            }
          },
          name_en: { type: :string, example: 'Bank Accounts' },
          name_fa: { type: :string, example: 'حساب‌های بانکی' }
        }
      }

      response '200', 'Creates the new center type successfully' do
        schema type: :object, properties: center_type_attributes
        let(:organization_id) { organization.id }
        let(:params) { {
          first_code: '101',
          last_code: '150',
          auto_increment: true,
          metadata: [
            {
              id: 'swift_code',
              name: { en: 'Swift Code', fa: 'کد سوئیفت' },
              type: 'text',
              required: true
            }
          ],
          name_en: 'Bank Accounts',
          name_fa: 'حساب‌های بانکی'
        } }

        before { create(:permission, code: Permission::ACCOUNTING_MANAGE_SETTINGS, grantee: member, organization: organization) }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to be > 0
          expect(data["first_code"]).to eq("101")
          expect(data["last_code"]).to eq("150")
          expect(data["metadata"]).to be_an(Array)
          expect(data["metadata"].length).to eq(1)
          expect(data["metadata"][0]["id"]).to eq("swift_code")
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:params) { { first_code: '101', last_code: '150', name_en: 'Test' } }

        before { member }

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end

      response '422', 'Invalid request' do
        let(:organization_id) { organization.id }
        let(:params) { { first_code: '', last_code: '' } }

        before { create(:permission, code: Permission::ACCOUNTING_MANAGE_SETTINGS, grantee: member, organization: organization) }

        run_test! do |response|
          expect(response).to have_http_status(:unprocessable_content)
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/center_types/{id}' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer, description: 'Center Type ID', required: true

    patch 'Updates the center type' do
      tags 'Center Types'
      consumes 'application/json'
      produces 'application/json'

      parameter name: :params, in: :body, schema: {
        type: :object,
        properties: {
          first_code: { type: :string, example: '001' },
          last_code: { type: :string, example: '010' },
          auto_increment: { type: :boolean, example: false },
          metadata: { type: :array, items: { type: :object } },
          name_en: { type: :string, example: 'Updated Name' }
        }
      }

      response '200', 'Updates the center type successfully' do
        schema type: :object, properties: center_type_attributes
        let(:organization_id) { organization.id }
        let(:id) { center_type_1.id }
        let(:params) { { last_code: '060', auto_increment: false } }

        before { create(:permission, code: Permission::ACCOUNTING_MANAGE_SETTINGS, grantee: member, organization: organization) }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to eq(center_type_1.id)
          expect(data["last_code"]).to eq("060")
          expect(data["auto_increment"]).to eq(false)
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:id) { center_type_1.id }
        let(:params) { { last_code: '060' } }

        before { member }

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end

    delete 'Deletes the center type' do
      tags 'Center Types'
      produces 'application/json'

      response '200', 'Deletes the center type successfully' do
        schema type: :object, properties: center_type_attributes
        let(:organization_id) { organization.id }
        let(:id) { center_type_1.id }

        before { create(:permission, code: Permission::ACCOUNTING_MANAGE_SETTINGS, grantee: member, organization: organization) }

        run_test! do |response|
          expect(Accounting::CenterType.find_by(id: center_type_1.id)).to be_nil
        end
      end
    end
  end
end
