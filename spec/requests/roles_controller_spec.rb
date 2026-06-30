require 'swagger_helper'

RSpec.describe 'Roles API', type: :request do
  # Swagger attribute definitions for index and show responses
  attributes = {
    id: { type: :integer, example: 1 },
    name: { type: :string, example: 'Engineering Manager' },
    description: { type: %i[string nil], example: 'Can edit content' },
    active: { type: :boolean, example: true },
    department: { type: %i[object null], example: { id: 1, name: 'Finance', abbreviation: 'FIN' }  },
    parent_id: { type: %i[integer null], example: nil },
    member: { type: %i[object null], example: { id: 1, name: 'John Doe' } }
  }

  let(:organization) { create(:organization) }
  let(:user) { create(:user, :admin) }
  let!(:member) { create(:member, organization:, user:) }
  let!(:role) { create(:role, organization:, member:, name: { en: 'Finance Manager' }) }
  let(:other_role) { create(:role, organization:, name: { en: 'Accountant' }) }


  before do
    create(:permission, code: Permission::ORG_ADMIN, grantee: member, organization:)
    sign_in user
  end

  path '/organizations/{organization_id}/roles' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true

    get 'Get all organization roles' do
      tags 'Roles'
      produces 'application/json'

      response '200', 'Loaded successfully' do
        schema type: :array, items: { type: :object, properties: attributes }
        let(:organization_id) { organization.id }
        before { other_role }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.map { |d| d["id"] }).to contain_exactly(role.id, other_role.id)
        end
      end
    end

    post 'Creating a new role' do
      tags 'Roles'
      consumes 'application/json'
      produces 'application/json'

      parameter name: :params, in: :body, schema: { type: :object, properties: {
          name_en: { type: :string, example: 'Jr. Accountant' },
          name_fa: { type: :string, example: 'کارآموز حسابداری' },
          description_en: { type: :string, example: 'Part time contractor' },
          description_fa: { type: :string, example: 'نیروی قراردادی پاره وقت' },
          parent_id: { type: :integer, example: 1 },
          department_id: { type: :integer, example: 1 },
          member_id: { type: :integer, example: 1 },
        }
      }

      response '200', 'Creates the new role successfully' do
        schema type: :object, properties: attributes
        let(:organization_id) { organization.id }
        let(:params) { {
          name_en: 'Engineering',
          name_fa: 'مهندسی',
          description_en: 'Engineering team',
          description_fa: 'تیم مهندسی',
          department_id: nil,
          member_id: member.id
        } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to be > 0
          expect(data["name"]).to eq("Engineering")
          expect(data["member"]["name"]).to eq(member.name)
          expect(data["active"]).to eq(true)
        end
      end
    end
  end

  path '/organizations/{organization_id}/roles/{id}' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer, description: 'Role ID', required: true

    get 'Get the role' do
      tags 'Roles'
      produces 'application/json'

      response '200', 'Loaded successfully' do
        schema type: :object, properties: attributes
        let(:organization_id) { organization.id }
        let(:id) { role.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to eq(role.id)
        end
      end
    end

    patch 'Updates the role' do
      tags 'Roles'
      consumes 'application/json'
      produces 'application/json'

      parameter name: :params, in: :body, schema: { type: :object, properties: {
          name_en: { type: :string, example: 'Updated Name' },
          description_en: { type: %i[string nil], example: 'Updated description' },
          member_id: { type: %i[string nil], example: "1" },
          active: { type: :boolean, example: false }
        }
      }

      response '200', 'Updates the role successfully' do
        schema type: :object, properties: attributes
        let(:organization_id) { organization.id }
        let(:id) { role.id }
        let(:params) { { name_en: 'Updated Name', description_en: 'Updated description', member_id: member.id, active: false } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to eq(role.id)
          expect(data["description"]).to eq("Updated description")
          expect(data["name"]).to eq("Updated Name")
          expect(data["active"]).to eq(false)
        end
      end
    end

    delete 'Deletes the role' do
      tags 'Roles'
      produces 'application/json'

      response '200', 'Deletes the role successfully' do
        let(:organization_id) { organization.id }
        let(:id) { role.id }

        run_test! do |response|
          expect(Role.find_by(id: role.id)).to be_nil
        end
      end
    end
  end
end
