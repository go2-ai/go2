# spec/requests/versions_controller_spec.rb
require 'swagger_helper'

RSpec.describe 'Versions API', type: :request do
  # ✅ Updated Swagger attribute definitions to match actual response
  version_schema = {
    type: :object,
    properties: {
      id: { type: :integer, example: 1 },
      event: { type: :string, enum: %w[create update destroy], example: 'update' },
      # ✅ Accept string format (not RFC3339)
      created_at: { type: :string, example: '2026-08-02 20:00:06 UTC' },
      item_type: { type: :string, example: 'Department' },
      item_id: { type: :integer, example: 1 },
      whodunnit: { type: :string, example: '1' },
      user_display: { type: :string, example: 'John Doe' },
      record_display_name: { type: :string, example: 'Engineering' },
      user_avatar: { type: %i[string null], example: nil },
      user_initial: { type: :string, example: 'JD' },
      object_data: { type: %i[object null], example: nil },
      changes: {
        type: :array,
        items: {
          type: :object,
          properties: {
            field: { type: :string, example: 'name' },
            # ✅ Allow string, object, or null for translated fields
            from: { type: %i[string object integer null], example: 'Old Name' },
            to: { type: %i[string object integer null], example: 'New Name' },
            field_label: { type: :string, example: 'Name' }
          }
        }
      }
    }
  }

  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let(:department) { create(:department, organization:) }

  shared_context 'with org admin user' do
    before do |example|
      member = create(:member, organization:, user:)
      create(:permission, code: Permission::ORG_ADMIN, grantee: member, organization:)
      sign_in user
      PaperTrail.enabled = true
      PaperTrail.request.whodunnit = user.id
    end

    after do
      PaperTrail.enabled = false
    end
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
        include_context 'with org admin user'

        schema type: :array, items: version_schema

        let(:organization_id) { organization.id }
        let(:record_type) { 'Department' }
        let(:record_id) { department.id }

        before do
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
        include_context 'with org admin user'

        schema type: :array, items: version_schema

        let(:organization_id) { organization.id }
        let(:deleted) { 'true' }

        before do
          department.destroy
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to be_an(Array)
          expect(data.first['event']).to eq('destroy')
        end
      end

      response '200', 'Returns deleted records filtered by model type' do
        include_context 'with org admin user'

        schema type: :array, items: version_schema

        let(:organization_id) { organization.id }
        let(:deleted) { 'true' }
        let(:model_type) { 'Department' }

        before do
          department.destroy
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to be_an(Array)
          expect(data.first['item_type']).to eq('Department')
        end
      end

      response '400', 'Invalid request - missing parameters' do
        include_context 'with org admin user'

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
          # ✅ Create a member record for the unauthorized user (without admin permissions)
          create(:member, organization:, user: unauthorized_user)
          sign_in unauthorized_user
        end

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end
  end

  describe 'Authorization' do
    let(:organization_id) { organization.id }

    context 'with GO3 admin user' do
      let(:admin_user) { create(:user, role: User::GO3_ADMIN) }

      before do
        sign_in admin_user
        PaperTrail.enabled = true
        PaperTrail.request.whodunnit = admin_user.id
        department.update!(name: 'Updated Department')
      end

      after do
        PaperTrail.enabled = false
      end

      it 'allows access to versions' do
        # ✅ Add .json to the path or set Accept header
        get organization_versions_path(
          organization_id: organization.id,
          record_type: 'Department',
          record_id: department.id
        ), headers: { 'ACCEPT' => 'application/json' }

        expect(response).to have_http_status(:ok)
      end
    end

    context 'with regular user without org admin permissions' do
      let(:regular_user) { create(:user) }

      before do
        create(:member, organization:, user: regular_user)
        sign_in regular_user
      end

      it 'prevents access to versions' do
        # ✅ Add .json to the path or set Accept header
        get organization_versions_path(
          organization_id: organization.id,
          record_type: 'Department',
          record_id: department.id
        ), headers: { 'ACCEPT' => 'application/json' }

        expect(response).to have_http_status(:forbidden)
      end
    end
  end
end
