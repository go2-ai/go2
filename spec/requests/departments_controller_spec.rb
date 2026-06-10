require 'swagger_helper'

RSpec.describe 'Organizations::Departments API', type: :request do
  index_attributes = {
    id: { type: :integer, example: 1 },
    name: { type: :string, example: 'Engineering' },
    description: { type: %i[string nil], example: 'Developers, UI/UX, QA, and mobile' },
    abbreviation: { type: %i[string nil], example: 'ENG' }
  }

  show_attributes = index_attributes.merge({
    t: { type: :object }, example: { name: { en: 'Engineering', fa: 'مهندسی' } }
  })

  let(:organization) { create(:organization, active_locales: [ 'fa' ]) }
  let(:user) { create(:user) }
  let(:current_member) { create(:member, organization:, user:) }
  let!(:department_1) { create(:department, name: { en: 'ENG' }, organization:) }
  let(:department_2) { create(:department, name: { en: 'FIN' }, organization:) }

  before do
    create(:permission, code: Permission::ORG_ADMIN, grantee: current_member, organization:)
    sign_in(user)
  end

  path '/organizations/{organization_id}/departments' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true

    get 'Get all organization departments' do
      tags 'Departments'
      produces 'application/json'

      response '200', 'Loaded successfully' do
        schema type: :array, items: { type: :object, properties: index_attributes }
        let(:organization_id) { organization.id }
        before { department_2 }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.map { |d| d["id"] }).to contain_exactly(department_1.id, department_2.id)
        end
      end
    end

    post 'Creating a new department' do
      tags 'Departments'
      consumes 'application/json'
      produces 'application/json'

      parameter name: :params, in: :body, schema: { type: :object, properties: {
          name_en: { type: :string, example: 'Engineering' },
          name_fa: { type: :string, example: 'مهندسی' },
          description_en: { type: :string, example: 'Engineering team' },
          description_fa: { type: :string, example: 'تیم مهندسی' },
          abbreviation: { type: :string, example: 'ENG' }
        }
      }

      response '200', 'Creates the new department successfully' do
        schema type: :object, properties: index_attributes
        let(:organization_id) { organization.id }
        let(:params) { {
          name_en: 'Engineering',
          name_fa: 'مهندسی',
          description_en: 'Engineering team',
          description_fa: 'تیم مهندسی',
          abbreviation: 'ENG'
        } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to be > 0
          expect(data["abbreviation"]).to eq("ENG")
        end
      end
    end
  end

  path '/organizations/{organization_id}/departments/{id}' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer, description: 'Department ID', required: true

    get 'Get the department' do
      tags 'Departments'
      produces 'application/json'

      response '200', 'Loaded successfully' do
        schema type: :object, properties: show_attributes
        let(:organization_id) { organization.id }
        let(:id) { department_1.id }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to eq(department_1.id)
        end
      end
    end

    patch 'Updates the department' do
      tags 'Departments'
      consumes 'application/json'
      produces 'application/json'

      parameter name: :params, in: :body, schema: { type: :object, properties: {
          name_en: { type: :string, example: 'Updated Name' },
          description_en: { type: %i[string nil], example: 'Updated description' },
          abbreviation: { type: %i[string nil], example: 'ENG2' }
        }
      }

      response '200', 'Updates the department successfully' do
        schema type: :object, properties: index_attributes
        let(:organization_id) { organization.id }
        let(:id) { department_1.id }
        let(:params) { { name_en: 'Updated Name', abbreviation: 'ENG2' } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to eq(department_1.id)
          expect(data["abbreviation"]).to eq("ENG2")
          expect(data["name"]).to eq("Updated Name")
        end
      end
    end

    delete 'Deletes the department' do
      tags 'Departments'
      produces 'application/json'

      response '200', 'Deletes the department successfully' do
        let(:organization_id) { organization.id }
        let(:id) { department_1.id }

        run_test! do |response|
          expect(Department.find_by(id: department_1.id)).to be_nil
        end
      end
    end
  end
end
