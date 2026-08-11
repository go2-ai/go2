# spec/requests/permissions_controller_spec.rb
require 'swagger_helper'

RSpec.describe 'Permissions API', type: :request do
  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let(:admin_member) { create(:member, organization:, user:) }   # renamed
  let(:role) { create(:role, organization:) }
  let(:department) { create(:department, organization:) }
  let(:group) { create(:group, organization:) }

  before do
    create(:permission, code: Permission::ORG_ADMIN, grantee: admin_member, organization:)
    sign_in user
  end

  path '/organizations/{organization_id}/permissions/grantable' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true

    get 'Get all grantable permissions' do
      tags 'Permissions'
      produces 'application/json'

      response '200', 'Returns grantable permissions' do
        schema type: :array,
               items: {
                 type: :object,
                 properties: {
                   code: { type: :string },
                   name: { type: :string },
                   abilities: { type: :array, items: { type: :string } },
                   tags: { type: :array, items: { type: :string } }
                 }
               }

        let(:organization_id) { organization.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to be_an(Array)
          expect(data.first.keys).to include('code', 'name', 'abilities', 'tags')
          expect(data.map { |p| p['code'] }).to include(Permission::ORG_ADMIN)
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
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

  path '/organizations/{organization_id}/permissions' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true

    get 'Get permissions' do
      tags 'Permissions'
      produces 'application/json'

      parameter name: :code, in: :query, type: :string, required: false, description: 'Filter by permission code'
      parameter name: :member_id, in: :query, type: :integer, required: false, description: 'Filter by member ID'
      parameter name: :include_indirect, in: :query, type: :boolean, required: false, description: 'Include indirect permissions'

      response '200', 'Returns all permissions' do
        schema type: :array,
               items: {
                 type: :object,
                 properties: {
                   id: { type: :integer },
                   code: { type: :string },
                   grantee_type: { type: :string },
                   grantee_id: { type: :integer },
                   organization_id: { type: :integer },
                   created_at: { type: :string },
                   updated_at: { type: :string },
                   grantee_name: { type: :string }
                 }
               }

        let(:organization_id) { organization.id }


        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to be_an(Array)
          expect(data.first.keys).to include('id', 'code', 'grantee_type', 'grantee_id', 'grantee_name')
        end
      end

      response '200', 'Returns permissions filtered by code' do
        schema type: :array

        let(:organization_id) { organization.id }
        let(:code) { Permission::ORG_ADMIN }

        before do
          create(:permission, code: Permission::ACCOUNTING_VIEW_ACCOUNTS, grantee: role, organization:)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to be_an(Array)
          expect(data.all? { |p| p['code'] == Permission::ORG_ADMIN }).to be true
        end
      end

      response '200', 'Returns permissions for a specific member' do
        let(:organization_id) { organization.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to be_an(Array)
          expect(data.first['grantee_id']).to eq(admin_member.id)
        end
      end

      response '200', 'Returns direct + indirect permissions for a member' do
        let(:organization_id) { organization.id }
        let(:member_id) { admin_member.id }
        let(:include_indirect) { 'true' }

        before do
          create(:permission, code: Permission::ACCOUNTING_VIEW_ACCOUNTS, grantee: role, organization:)
          role.update(member: admin_member)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to be_an(Array)
          expect(data.size).to eq(2)
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:unauthorized_user) { create(:user) }

        before do
          sign_in unauthorized_user
        end

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end

    post 'Grant a permission' do
      tags 'Permissions'
      consumes 'application/json'
      produces 'application/json'

      parameter name: :params, in: :body, schema: {
        type: :object,
        properties: {
          code: { type: :string, example: 'Organization.admin' },
          grantee_type: { type: :string, enum: %w[Member Role Department Group] },
          grantee_id: { type: :integer, example: 1 }
        },
        required: %w[code grantee_type grantee_id]
      }

      response '200', 'Permission granted successfully' do
        schema type: :object,
               properties: {
                 id: { type: :integer },
                 code: { type: :string },
                 grantee_type: { type: :string },
                 grantee_id: { type: :integer },
                 organization_id: { type: :integer },
                 created_at: { type: :string },
                 updated_at: { type: :string },
                 grantee_name: { type: :string }
               }

        let(:organization_id) { organization.id }
        let(:params) do
          {
            code: Permission::ACCOUNTING_VIEW_ACCOUNTS,
            grantee_type: 'Member',
            grantee_id: admin_member.id
          }
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['code']).to eq(Permission::ACCOUNTING_VIEW_ACCOUNTS)
          expect(data['grantee_type']).to eq('Member')
          expect(data['grantee_id']).to eq(admin_member.id)
          expect(data['grantee_name']).to eq(admin_member.name)
        end
      end

      response '422', 'Invalid request' do
        let(:organization_id) { organization.id }
        let(:params) do
          {
            code: Permission::ACCOUNTING_VIEW_ACCOUNTS,
            grantee_type: 'Member',
            grantee_id: nil
          }
        end

        run_test! do |response|
          expect(response).to have_http_status(:unprocessable_entity)
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:unauthorized_user) { create(:user) }

        before do
          sign_in unauthorized_user
        end

        let(:params) do
          {
            code: Permission::ACCOUNTING_VIEW_ACCOUNTS,
            grantee_type: 'Member',
            grantee_id: admin_member.id
          }
        end

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end
  end

  path '/organizations/{organization_id}/permissions/{id}' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer, description: 'Permission ID', required: true

    delete 'Revoke a permission' do
      tags 'Permissions'
      produces 'application/json'

      response '200', 'Permission revoked successfully' do
        schema type: :object,
               properties: {
                 id: { type: :integer },
                 code: { type: :string },
                 grantee_type: { type: :string },
                 grantee_id: { type: :integer },
                 organization_id: { type: :integer },
                 created_at: { type: :string },
                 updated_at: { type: :string },
                 grantee_name: { type: :string }
               }

        let(:organization_id) { organization.id }
        let(:permission) { create(:permission, organization:, code: Permission::ACCOUNTING_VIEW_ACCOUNTS, grantee: admin_member) }
        let(:id) { permission.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to eq(permission.id)
          expect(Permission.find_by(id: permission.id)).to be_nil
        end
      end

      response '404', 'Permission not found' do
        let(:organization_id) { organization.id }
        let(:id) { 99999 }

        run_test! do |response|
          expect(response).to have_http_status(:not_found)
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:unauthorized_user) { create(:user) }
        let(:permission) { create(:permission, organization:, code: Permission::ACCOUNTING_VIEW_ACCOUNTS, grantee: admin_member) }
        let(:id) { permission.id }

        before do
          sign_in unauthorized_user
        end

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end
  end
end
