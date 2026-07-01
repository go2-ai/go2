require 'swagger_helper'

RSpec.describe 'Groups API', type: :request do
  # Swagger attribute definitions for index and show responses
  attributes = {
    id: { type: :integer, example: 1 },
    name: { type: :string, example: 'Musicians' },
    description: { type: %i[string nil], example: 'Group for musicians' },
    members: {
      type: :array,
      items: {
        type: :object,
        properties: {
          id: { type: :integer, example: 1 },
          name: { type: :string, example: 'John Doe' }
        }
      }
    }
  }

  let(:organization) { create(:organization) }
  let(:user) { create(:user, :admin) }
  let!(:member) { create(:member, organization:, user:) }
  let!(:other_member) { create(:member, organization:) }
  let!(:group) { create(:group, organization:, name: { en: 'Musicians' }, member_ids: [ member.id ]) }
  let(:other_group) { create(:group, organization:, name: { en: 'Actors' }) }

  before do
    create(:permission, code: Permission::ORG_ADMIN, grantee: member, organization:)
    sign_in user
  end

  path '/organizations/{organization_id}/groups' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true

    get 'Get all organization groups' do
      tags 'Groups'
      produces 'application/json'

      response '200', 'Loaded successfully' do
        schema type: :array, items: { type: :object, properties: attributes }
        let(:organization_id) { organization.id }
        before { other_group }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.map { |d| d["id"] }).to contain_exactly(group.id, other_group.id)
        end
      end
    end

    post 'Creating a new group' do
      tags 'Groups'
      consumes 'application/json'
      produces 'application/json'

      parameter name: :params, in: :body, schema: { type: :object, properties: {
          name_en: { type: :string, example: 'Engineering' },
          name_fa: { type: :string, example: 'مهندسی' },
          description_en: { type: :string, example: 'Engineering team' },
          description_fa: { type: :string, example: 'تیم مهندسی' },
          member_ids: { type: :array, items: { type: :integer }, example: [ 1, 2, 3 ] }
        }
      }

      response '200', 'Creates the new group successfully' do
        schema type: :object, properties: attributes
        let(:organization_id) { organization.id }
        let(:params) { {
          name_en: 'Engineering',
          name_fa: 'مهندسی',
          description_en: 'Engineering team',
          description_fa: 'تیم مهندسی',
          member_ids: [ member.id, other_member.id ]
        } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to be > 0
          expect(data["name"]).to eq("Engineering")
          expect(data["members"].map { |m| m["id"] }).to contain_exactly(member.id, other_member.id)
        end
      end
    end
  end

  path '/organizations/{organization_id}/groups/{id}' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer, description: 'Group ID', required: true

    get 'Get the group' do
      tags 'Groups'
      produces 'application/json'

      response '200', 'Loaded successfully' do
        schema type: :object, properties: attributes
        let(:organization_id) { organization.id }
        let(:id) { group.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to eq(group.id)
        end
      end
    end

    patch 'Updates the group' do
      tags 'Groups'
      consumes 'application/json'
      produces 'application/json'

      parameter name: :params, in: :body, schema: { type: :object, properties: {
          name_en: { type: :string, example: 'Updated Name' },
          description_en: { type: %i[string nil], example: 'Updated description' },
          member_ids: { type: :array, items: { type: :integer }, example: [ 1, 2 ] }
        }
      }

      response '200', 'Updates the group successfully' do
        schema type: :object, properties: attributes
        let(:organization_id) { organization.id }
        let(:id) { group.id }
        let(:params) { { name_en: 'Updated Name', description_en: 'Updated description', member_ids: [ other_member.id ] } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to eq(group.id)
          expect(data["name"]).to eq("Updated Name")
          expect(data["description"]).to eq("Updated description")
          expect(data["members"].map { |m| m["id"] }).to contain_exactly(other_member.id)
        end
      end
    end

    delete 'Deletes the group' do
      tags 'Groups'
      produces 'application/json'

      response '200', 'Deletes the group successfully' do
        let(:organization_id) { organization.id }
        let(:id) { group.id }

        run_test! do |response|
          expect(Group.find_by(id: group.id)).to be_nil
        end
      end
    end
  end
end
