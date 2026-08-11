# spec/requests/accounting/centers_controller_spec.rb
require 'swagger_helper'

RSpec.describe 'Accounting::Centers API', openapi_spec: 'v1/accounting.yaml', type: :request do
  center_attributes = {
    id: { type: :integer, example: 1 },
    code: { type: :string, example: '000025' },
    name: { type: :string, example: 'Main Warehouse' },
    centerable_type: { type: %i[string nil], example: nil },
    centerable_id: { type: %i[integer nil], example: nil },
    t: { type: :object, example: { name: { en: 'Main Warehouse', fa: 'انبار اصلی' } } },
    center_type: {
      type: :object,
      example: {
        id: 1,
        first_code: '000001',
        last_code: '000050',
        auto_increment: true,
        name: 'Warehouses',
        t: { name: { en: 'Warehouses', fa: 'انبارها' } }
      }
    }
  }

  center_with_metadata_attributes = center_attributes.merge(
    metadata: { type: :object, example: { swift_code: 'AABBCC', age: 25 } }
  )

  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let(:member) { create(:member, organization: organization, user: user) }
  let(:center_type) do
    create(:accounting_center_type, organization: organization,
           first_code: '000001', last_code: '000050', name: { en: 'Warehouses' })
  end
  let(:center_type_2) do
    create(:accounting_center_type, organization: organization,
           first_code: '000051', last_code: '000100', name: { en: 'Cost Centers' })
  end
  let!(:center_1) do
    create(:accounting_center, center_type: center_type, code: '000001',
           name: { en: 'Main Warehouse' })
  end
  let!(:center_2) do
    create(:accounting_center, center_type: center_type, code: '000002',
           name: { en: 'Secondary Warehouse' })
  end
  let!(:center_3) do
    create(:accounting_center, center_type: center_type_2, code: '000051',
           name: { en: 'Administration' })
  end

  before { sign_in(user) }

  path '/organizations/{organization_id}/accounting/centers' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true

    get 'Get all organization centers' do
      tags 'Centers'
      produces 'application/json'
      parameter name: :center_type_id, in: :query, type: :integer, required: false,
                description: 'Filter by center type (includes metadata)'

      response '200', 'Returns all centers across all center types (without metadata)' do
        schema type: :array, items: { type: :object, properties: center_attributes }
        let(:organization_id) { organization.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.length).to eq(3)
          expect(data.map { |c| c['id'] }).to contain_exactly(center_1.id, center_2.id, center_3.id)
          expect(data.first).not_to have_key('metadata')
        end
      end

      response '200', 'Returns centers filtered by center type (with metadata)' do
        schema type: :array, items: { type: :object, properties: center_with_metadata_attributes }
        let(:organization_id) { organization.id }
        let(:center_type_id) { center_type.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.length).to eq(2)
          expect(data.map { |c| c['id'] }).to contain_exactly(center_1.id, center_2.id)
          expect(data.first).to have_key('metadata')
        end
      end
    end

    post 'Creating a new center' do
      tags 'Centers'
      consumes 'application/json'
      produces 'application/json'

      parameter name: :params, in: :body, schema: {
        type: :object,
        properties: {
          center_type_id: { type: :integer, example: 1 },
          code: { type: :string, example: '000010' },
          metadata: {
            type: :object,
            example: { swift_code: 'AABBCC', age: 25 }
          },
          name_en: { type: :string, example: 'Branch Office' },
          name_fa: { type: :string, example: 'دفتر شعبه' }
        }
      }

      response '200', 'Creates the new center successfully with explicit code' do
        schema type: :object, properties: center_with_metadata_attributes
        let(:organization_id) { organization.id }
        let(:params) { {
          center_type_id: center_type.id,
          code: '000010',
          metadata: { swift_code: 'AABBCC', age: 25 },
          name_en: 'Branch Office',
          name_fa: 'دفتر شعبه'
        } }

        before { create(:permission, code: Permission::ACCOUNTING_MANAGE_SETTINGS, grantee: member, organization: organization) }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to be > 0
          expect(data['code']).to eq('000010')
          expect(data['metadata']).to be_a(Hash)
          expect(data['metadata']['swift_code']).to eq('AABBCC')
          expect(data['metadata']['age']).to eq(25)
        end
      end

      response '200', 'Auto-assigns next available code when auto_increment is enabled' do
        schema type: :object, properties: center_with_metadata_attributes
        let(:organization_id) { organization.id }
        # center_1 has 000001, center_2 has 000002 — next should be 000003
        let(:params) { {
          center_type_id: center_type.id,
          name_en: 'Auto Center'
        } }

        before { create(:permission, code: Permission::ACCOUNTING_MANAGE_SETTINGS, grantee: member, organization: organization) }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to be > 0
          expect(data['code']).to eq('000003')
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:params) { { center_type_id: center_type.id, code: '000010', name_en: 'Test' } }

        before { member }

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end

      response '422', 'Invalid request' do
        let(:organization_id) { organization.id }
        let(:params) { { center_type_id: center_type.id, code: '999999', name_en: 'Test' } }

        before { create(:permission, code: Permission::ACCOUNTING_MANAGE_SETTINGS, grantee: member, organization: organization) }

        run_test! do |response|
          expect(response).to have_http_status(:unprocessable_content)
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/centers/{id}' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer, description: 'Center ID', required: true

    get 'Get the center (with metadata)' do
      tags 'Centers'
      produces 'application/json'

      response '200', 'Loaded successfully' do
        schema type: :object, properties: center_with_metadata_attributes
        let(:organization_id) { organization.id }
        let(:id) { center_1.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to eq(center_1.id)
          expect(data).to have_key('metadata')
          expect(data).to have_key('center_type')
        end
      end

      response '404', 'Not found' do
        let(:organization_id) { organization.id }
        let(:id) { 99999 }

        run_test! do |response|
          expect(response).to have_http_status(:not_found)
        end
      end
    end

    patch 'Updates the center' do
      tags 'Centers'
      consumes 'application/json'
      produces 'application/json'

      parameter name: :params, in: :body, schema: {
        type: :object,
        properties: {
          code: { type: :string, example: '000005' },
          metadata: { type: :object, example: { swift_code: 'UPDATED' } },
          name_en: { type: :string, example: 'Updated Name' }
        }
      }

      response '200', 'Updates the center successfully' do
        schema type: :object, properties: center_with_metadata_attributes
        let(:organization_id) { organization.id }
        let(:id) { center_1.id }
        let(:params) { { code: '000005', name_en: 'Updated Warehouse' } }

        before { create(:permission, code: Permission::ACCOUNTING_MANAGE_SETTINGS, grantee: member, organization: organization) }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to eq(center_1.id)
          expect(data['code']).to eq('000005')
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:id) { center_1.id }
        let(:params) { { code: '000005' } }

        before { member }

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end

    delete 'Deletes the center' do
      tags 'Centers'
      produces 'application/json'

      response '200', 'Deletes the center successfully' do
        schema type: :object, properties: center_with_metadata_attributes
        let(:organization_id) { organization.id }
        let(:id) { center_1.id }

        before { create(:permission, code: Permission::ACCOUNTING_MANAGE_SETTINGS, grantee: member, organization: organization) }

        run_test! do |response|
          expect(Accounting::Center.find_by(id: center_1.id)).to be_nil
        end
      end
    end
  end
end
