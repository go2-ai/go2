require 'swagger_helper'

RSpec.describe 'FiscalYears API', type: :request do
  attributes = {
    id: { type: :integer, example: 1 },
    name: { type: :string, example: 'Fiscal Year 2024' },
    start_date: { type: :string, example: '2024-01-01' },
    finish_date: { type: :string, example: '2024-12-31' },
    t: {
      type: :object,
      example: { name: { en: 'Fiscal Year 2024', fa: 'سال مالی 2024' } }
    }
  }

  let(:organization) { create(:organization, active_locales: [ 'fa' ]) }
  let(:user) { create(:user) }
  let(:current_member) { create(:member, organization:, user:) }
  let!(:fiscal_year_1) do
    create(:fiscal_year,
      organization:,
      name: { en: 'Fiscal Year 2024', fa: 'سال مالی 2024' },
      start_date: Date.new(2024, 1, 1),
      finish_date: Date.new(2024, 12, 31)
    )
  end
  let(:fiscal_year_2) do
    create(:fiscal_year,
      organization:,
      name: { en: 'Fiscal Year 2025', fa: 'سال مالی 2025' },
      start_date: Date.new(2025, 1, 1),
      finish_date: Date.new(2025, 12, 31)
    )
  end

  before do
    create(:permission, code: Permission::ORG_ADMIN, grantee: current_member, organization:)
    sign_in(user)
  end

  path '/organizations/{organization_id}/fiscal_years' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true

    get 'Get all organization fiscal years' do
      tags 'FiscalYears'
      produces 'application/json'

      response '200', 'Loaded successfully' do
        schema type: :array, items: { type: :object, properties: attributes }
        let(:organization_id) { organization.id }
        before { fiscal_year_2 }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.map { |d| d["id"] }).to contain_exactly(fiscal_year_1.id, fiscal_year_2.id)
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:unauthorized_user) { create(:user) }

        before do
          create(:member, organization:, user: unauthorized_user)
          sign_in unauthorized_user
        end

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end

    post 'Creating a new fiscal year' do
      tags 'FiscalYears'
      consumes 'application/json'
      produces 'application/json'

      parameter name: :params, in: :body, schema: {
        type: :object,
        properties: {
          name_en: { type: :string, example: 'Fiscal Year 2025' },
          name_fa: { type: :string, example: 'سال مالی 2025' },
          start_date: { type: :string, example: '2025-01-01' },
          finish_date: { type: :string, example: '2025-12-31' }
        },
        required: %w[start_date finish_date]
      }

      response '200', 'Creates the new fiscal year successfully' do
        schema type: :object, properties: attributes
        let(:organization_id) { organization.id }
        let(:params) { {
          name_en: 'Fiscal Year 2025',
          name_fa: 'سال مالی 2025',
          start_date: '2025-01-01',
          finish_date: '2025-12-31'
        } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to be > 0
          expect(data["name"]).to eq("Fiscal Year 2025")
          expect(data["start_date"]).to eq("2025-01-01")
          expect(data["finish_date"]).to eq("2025-12-31")
        end
      end

      response '422', 'Invalid request' do
        let(:organization_id) { organization.id }
        let(:params) { {
          name_en: 'Invalid FY',
          start_date: '2026-12-31',
          finish_date: '2026-01-01'
        } }

        run_test! do |response|
          expect(response).to have_http_status(:unprocessable_content)
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:unauthorized_user) { create(:user) }
        let(:params) { {
          name_en: 'Fiscal Year 2026',
          start_date: '2026-01-01',
          finish_date: '2026-12-31'
        } }

        before do
          create(:member, organization:, user: unauthorized_user)
          sign_in unauthorized_user
        end

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end
  end

  path '/organizations/{organization_id}/fiscal_years/{id}' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer, description: 'Fiscal Year ID', required: true

    patch 'Updates the fiscal year' do
      tags 'FiscalYears'
      consumes 'application/json'
      produces 'application/json'

      parameter name: :params, in: :body, schema: {
        type: :object,
        properties: {
          name_en: { type: :string, example: 'Updated Fiscal Year' },
          name_fa: { type: :string, example: 'سال مالی به‌روز شده' },
          start_date: { type: :string, example: '2024-01-01' },
          finish_date: { type: :string, example: '2024-12-31' }
        }
      }

      response '200', 'Updates the fiscal year successfully' do
        schema type: :object, properties: attributes
        let(:organization_id) { organization.id }
        let(:id) { fiscal_year_1.id }
        let(:params) { { name_en: 'Updated Fiscal Year' } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data["id"]).to eq(fiscal_year_1.id)
          expect(data["name"]).to eq("Updated Fiscal Year")
        end
      end

      response '404', 'Fiscal year not found' do
        let(:organization_id) { organization.id }
        let(:id) { 999999 }
        let(:params) { { name_en: 'Not Found' } }

        run_test! do |response|
          expect(response).to have_http_status(:not_found)
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:id) { fiscal_year_1.id }
        let(:params) { { name_en: 'Unauthorized' } }
        let(:unauthorized_user) { create(:user) }

        before do
          create(:member, organization:, user: unauthorized_user)
          sign_in unauthorized_user
        end

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end

    delete 'Deletes the fiscal year' do
      tags 'FiscalYears'
      produces 'application/json'

      response '200', 'Deletes the fiscal year successfully' do
        let(:organization_id) { organization.id }
        let(:id) { fiscal_year_1.id }

        run_test! do |response|
          expect(FiscalYear.find_by(id: fiscal_year_1.id)).to be_nil
        end
      end

      response '404', 'Fiscal year not found' do
        let(:organization_id) { organization.id }
        let(:id) { 999999 }

        run_test! do |response|
          expect(response).to have_http_status(:not_found)
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:id) { fiscal_year_1.id }
        let(:unauthorized_user) { create(:user) }

        before do
          create(:member, organization:, user: unauthorized_user)
          sign_in unauthorized_user
        end

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end
  end
end
