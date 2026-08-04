# spec/requests/versions_controller_spec.rb
require 'swagger_helper'

RSpec.describe 'Versions API', type: :request do
  # Swagger attribute definitions
  version_schema = {
    type: :object,
    properties: {
      id: { type: :integer, example: 1 },
      event: { type: :string, enum: %w[create update destroy], example: 'update' },
      created_at: { type: :string, format: 'date-time', example: '2024-01-15T10:30:00Z' },
      item_type: { type: :string, example: 'Department' },
      item_id: { type: :integer, example: 1 },
      whodunnit: { type: :string, example: '1' },
      user_display: { type: :string, example: 'John Doe' },
      record_display_name: { type: :string, example: 'Engineering' },
      user_avatar: { type: %i[string null], example: nil },
      user_initial: { type: :string, example: 'JD' },
      user_color: { type: :string, example: '#4F46E5' },
      changes: {
        type: :array,
        items: {
          type: :object,
          properties: {
            field: { type: :string, example: 'name' },
            from: { type: %i[string null], example: 'Old Name' },
            to: { type: %i[string null], example: 'New Name' },
            field_label: { type: :string, example: 'Name' }
          }
        }
      }
    }
  }

  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let(:member) { create(:member, organization:, user:) }
  let(:department) { create(:department, organization:) }

  before do
    create(:permission, code: Permission::ORG_ADMIN, grantee: member, organization:)
    sign_in user
    PaperTrail.enabled = true
  end

  after do
    PaperTrail.enabled = false
  end

  path '/organizations/{organization_id}/versions' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true

    get 'Get versions for a specific record or deleted records' do
      tags 'Versions'
      produces 'application/json'

      parameter name: :record_type, in: :query, type: :string, required: false, description: 'Record type (e.g., Department, Member)'
      parameter name: :record_id, in: :query, type: :integer, required: false, description: 'Record ID'
      parameter name: :deleted, in: :query, type: :boolean, required: false, description: 'Set to true to get deleted records'
      parameter name: :model_type, in: :query, type: :string, required: false, description: 'Filter deleted records by model type'
      parameter name: :limit, in: :query, type: :integer, required: false, description: 'Number of records to return', example: 50

      response '200', 'Returns versions for a specific record' do
        schema type: :array, items: version_schema

        let(:organization_id) { organization.id }
        let(:record_type) { 'Department' }
        let(:record_id) { department.id }

        before do
          PaperTrail.request.whodunnit = user.id
          department.update!(name: 'Updated Department')
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to be_an(Array)
          expect(data.first['item_type']).to eq('Department')
          expect(data.first['item_id']).to eq(department.id)
          expect(data.first['user_display']).to eq(user.full_name)
        end
      end

      response '200', 'Returns deleted records' do
        schema type: :array, items: version_schema

        let(:organization_id) { organization.id }
        let(:deleted) { 'true' }

        before do
          PaperTrail.request.whodunnit = user.id
          department.destroy
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to be_an(Array)
          expect(data.first['event']).to eq('destroy')
        end
      end

      response '200', 'Returns deleted records filtered by model type' do
        schema type: :array, items: version_schema

        let(:organization_id) { organization.id }
        let(:deleted) { 'true' }
        let(:model_type) { 'Department' }

        before do
          PaperTrail.request.whodunnit = user.id
          department.destroy
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to be_an(Array)
          expect(data.first['item_type']).to eq('Department')
        end
      end

      response '400', 'Invalid request - missing parameters' do
        let(:organization_id) { organization.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['error']).to include('Invalid request')
          expect(response).to have_http_status(:bad_request)
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:record_type) { 'Department' }
        let(:record_id) { department.id }
        let(:unauthorized_user) { create(:user) }

        before do
          sign_in unauthorized_user
        end

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end
  end

  path '/organizations/{organization_id}/versions/{id}' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer, description: 'Version ID', required: true

    get 'Get a specific version' do
      tags 'Versions'
      produces 'application/json'

      response '200', 'Returns the version' do
        schema version_schema

        let(:organization_id) { organization.id }
        let(:id) do
          PaperTrail.request.whodunnit = user.id
          department.update!(name: 'Updated Department')
          PaperTrail::Version.last.id
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to eq(id)
          expect(data['item_type']).to eq('Department')
          expect(data['user_display']).to eq(user.full_name)
        end
      end

      response '404', 'Version not found' do
        let(:organization_id) { organization.id }
        let(:id) { 99999 }

        run_test! do |response|
          expect(response).to have_http_status(:not_found)
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:id) do
          PaperTrail.request.whodunnit = user.id
          department.update!(name: 'Updated Department')
          PaperTrail::Version.last.id
        end
        let(:unauthorized_user) { create(:user) }

        before do
          sign_in unauthorized_user
        end

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end
  end

  # Additional authorization tests
  describe 'Authorization' do
    let(:organization_id) { organization.id }

    context 'with GO3 admin user' do
      let(:admin_user) { create(:user, role: User::GO3_ADMIN) }

      before do
        sign_in admin_user
        PaperTrail.request.whodunnit = admin_user.id
        department.update!(name: 'Updated Department')
      end

      it 'allows access to versions' do
        get organization_versions_path(organization_id: organization.id,
                                       record_type: 'Department',
                                       record_id: department.id)
        expect(response).to have_http_status(:ok)
      end
    end

    context 'with regular user without org admin permissions' do
      let(:regular_user) { create(:user) }
      let!(:regular_member) { create(:member, organization:, user: regular_user) }

      before do
        sign_in regular_user
      end

      it 'prevents access to versions' do
        get organization_versions_path(organization_id: organization.id,
                                       record_type: 'Department',
                                       record_id: department.id)
        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
