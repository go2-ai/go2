require 'swagger_helper'

# Tech debt: Add calendar_types to API docs
RSpec.describe 'Organizations API', type: :request do
  let!(:user) { create(:user) }
  before { sign_in(user) }

  path '/organizations' do
    post 'Create an organization' do
      tags 'Organizations'
      consumes 'application/json'
      produces 'application/json'
      parameter name: :organization, in: :body, schema: {
        type: :object,
        properties: {
          name: { type: :string, example: "Sample Organization", description: "If the name is not presented a random name will be assigned." },
          is_trial: { type: :boolean, example: true }
        },
        required: [ 'is_trial' ]
      }

      context 'By passing "is_trial" param' do
        response '200', 'Creates a trial organization' do
          schema type: :object, properties: {
            id: { type: :integer, example: 1 },
            name: { type: :string, example: 'Sample Organization' }
          }
          let(:organization) { { name: 'Sample Org', is_trial: true } }

          run_test! do |response|
            data = JSON.parse(response.body)
            expect(data["id"]).to be > 0
            org = Organization.find(data["id"])
            expect(org.members.count).to eq(1)
            expect(org.members.map { |m| m.user_id }).to contain_exactly(user.id)
            expect(user.is_org_admin?(org)).to eq(true)
          end
        end
      end
    end
  end
end
