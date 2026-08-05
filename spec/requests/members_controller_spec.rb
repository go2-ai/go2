require 'swagger_helper'

RSpec.describe 'Members API', type: :request do
  member_attributes = {
    id: { type: :integer, example: 1 },
    email: { type: :string, example: 'john.doe@example.com' },
    name: { type: :string, example: 'John Doe' },
    user_id: { type: %i[ integer nil ], example: 3 },
    organization_id: { type: :integer, example: 1 },
    created_at: { type: :string, example: '2026-02-20 10:52:46.787878000 +0000' },
    updated_at: { type: :string, example: '2026-02-20 10:52:46.787878000 +0000' },
    invited_at: { type: %i[string nil], example: '2026-02-20 10:52:46.787878000 +0000' },
    invitation_key: { type: %i[string nil], example: '0AB1CD2EF3' },
    joined_at: { type: %i[string nil], example: '2026-02-20 10:52:46.787878000 +0000' },
    archived_number: { type: %i[integer nil], example: 1 },
    archived_at: { type: %i[string nil], example: '2026-02-20 10:52:46.787878000 +0000' },
    initial: { type: %i[string nil], example: 'JD' },
    color: { type: %i[string nil], example: '#ff5512' },
    translations: { type: :object, example: { name: { en: 'John Doe', fa: 'جان دو' } } }
  }

  let(:organization) { create(:organization, active_locales: [ 'fa' ]) }
  let!(:member_1) { create(:member, organization:) }
  let(:member_2) { create(:member, organization:) }
  let(:user) { create(:user) }
  let(:current_member) { create(:member, organization:, user:) }

  before do
    create(:permission, code: Permission::ORG_ADMIN, grantee: current_member, organization:)
    sign_in(user)
  end

  path '/organizations/{organization_id}/members' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true

    get 'Get all organization members' do
      tags 'Members'
      produces 'application/json'

      response '200', 'Loaded successfully' do
        schema type: :array, items: { type: :object, properties: member_attributes }
        let(:organization_id) { organization.id }
        before { member_2 }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.map { |m| m["id"] }).to contain_exactly(member_1.id, member_2.id, current_member.id)
        end
      end
    end
  end

  path '/organizations/{organization_id}/members/{id}' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer, description: 'Member ID', required: true

    get 'Get the members' do
      tags 'Members'
      produces 'application/json'

      response '200', 'Loaded successfully' do
        schema type: :object, properties: member_attributes
        let(:organization_id) { organization.id }
        let(:id) { member_1.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to eq(member_1.id)
        end
      end
    end
  end

  path '/organizations/{organization_id}/members' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :params, in: :body, schema: { type: :object, properties: {
        email: { type: :string, example: 'john.doe@example.com' },
        name_en: { type: :string, example: 'John Doe' },
        name_fa: { type: :string, example: 'جان ذو' },
        color: { type: :string, example: '#ff5512' },
        initial: { type: :string, example: 'JD' },
        invite: { type: :boolean, example: true, description: 'If true, sends an invitation email including an invitation link' }
      }
    }

    post 'Creating a new member' do
      tags 'Members'
      consumes 'application/json'
      produces 'application/json'

      response '200', 'Creates the new member successfully' do
        schema type: :object, properties: member_attributes
        let(:organization_id) { organization.id }
        let(:params) { {
          name_en: 'John Doe',
          name_fa: 'جان دو',
          email: 'john.doe@example.com',
          color: '#ff5512',
          initial: 'JD',
          invite: true
        } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to be > 0
        end
      end
    end
  end

  path '/organizations/{organization_id}/members/{id}' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer, description: 'Member ID', required: true
    parameter name: :params, in: :body, schema: { type: :object, properties: {
        email: { type: :string, example: 'john.doe@example.com' },
        name_en: { type: :string, example: 'Updated Name' },
        color: { type: :string, example: '#ff5512' },
        initial: { type: :string, example: 'JD' },
        invite: { type: :boolean, example: true, description: 'If true, sends an invitation email including an invitation link' }
      }
    }

    patch 'Updates the members' do
      tags 'Members'
      consumes 'application/json'
      produces 'application/json'

      response '200', 'Updates the member successfully' do
        schema type: :object, properties: member_attributes.merge({ name_en: { type: :string, example: 'Updated Name' } })
        let(:organization_id) { organization.id }
        let(:id) { member_1.id }
        let(:params) { { name_en: 'Updated Name' } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to eq(member_1.id)
          expect(data["name"]).to eq("Updated Name")
        end
      end
    end
  end

  path '/organizations/{organization_id}/members/{id}/archive' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer, description: 'Member ID', required: true

    patch 'Archives the members' do
      tags 'Members'
      produces 'application/json'

      response '200', 'Archives the member successfully' do
        schema type: :object, properties: member_attributes
        let(:organization_id) { organization.id }
        let(:id) { member_1.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to eq(member_1.id)
          expect(data["status"]).to eq("archived")
        end
      end
    end
  end

  path '/organizations/{organization_id}/members/{id}/unarchive' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer, description: 'Member ID', required: true

    patch 'Unarchives the members' do
      tags 'Members'
      produces 'application/json'

      response '200', 'Unarchives the member successfully' do
        schema type: :object, properties: member_attributes
        let(:organization_id) { organization.id }
        let(:id) { member_1.id }
        before { member_1.archive! }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to eq(member_1.id)
          expect(data["archive_number"]).to be_nil
        end
      end
    end
  end

  path '/organizations/{organization_id}/members/{id}/set_as_admin' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer, description: 'Member ID', required: true

    patch 'Grants org admin permission to the members' do
      tags 'Members'
      produces 'application/json'

      response '200', 'Grants org admin permission to the member' do
        schema type: :object, properties: member_attributes

        let(:organization_id) { organization.id }
        let(:id) { member_1.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to eq(member_1.id)
          expect(data["org_admin"]).to eq(true)
        end
      end
    end
  end

  path '/organizations/{organization_id}/members/{id}/revoke_admin' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer, description: 'Member ID', required: true

    patch 'Revokes org admin permission from the members' do
      tags 'Members'
      produces 'application/json'

      response '200', 'Revokes org admin permission from the member' do
        schema type: :object, properties: member_attributes

        let(:organization_id) { organization.id }
        let(:id) { member_1.id }
        before { create(:permission, code: Permission::ORG_ADMIN, grantee: member_1, organization:) }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to eq(member_1.id)
          expect(data["org_admin"]).to eq(false)
        end
      end
    end
  end

  path '/organizations/{organization_id}/members/{id}/send_invitation' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer, description: 'Member ID', required: true

    post 'Sends invitation to the members' do
      tags 'Members'
      produces 'application/json'

      response '200', 'Sends invitation to the members' do
        schema type: :object, properties: member_attributes

        let(:organization_id) { organization.id }
        let(:id) { member_1.id }

        before { member_1.update(invited_at: nil, invitation_key: nil) }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to eq(member_1.id)
          expect(data["status"]).to eq("invited")
        end
      end
    end
  end
end
