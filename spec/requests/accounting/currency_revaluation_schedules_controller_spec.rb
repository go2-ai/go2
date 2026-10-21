require 'swagger_helper'

RSpec.describe 'Accounting::CurrencyRevaluationSchedules API', openapi_spec: 'v1/accounting.yaml', type: :request do
  let(:organization) { create(:organization, time_zone: 'Asia/Tehran') }
  let(:user) { create(:user) }
  let(:member) { create(:member, organization: organization, user: user) }
  let(:organization_id) { organization.id }

  before { sign_in user }

  def grant(code)
    create(:permission, code: code, grantee: member, organization: organization)
  end

  schedule_schema = {
    type: :object,
    properties: {
      id: { type: :integer }, name: { type: :string },
      rrule: { type: :string, example: 'FREQ=MONTHLY;BYMONTHDAY=-1' },
      dtstart: { type: :string, description: "First run; its local time of day is when runs happen" },
      scope: { type: :object },
      default_kind: { type: :string, enum: %w[temporary permanent] },
      on_unapproved: { type: :string, enum: %w[skip post_temporary partial] },
      active: { type: :boolean },
      next_run_at: { type: %i[string null] }, last_run_at: { type: %i[string null] },
      last_run_status: { type: %i[string null], enum: [ 'posted', 'no_change', 'skipped', 'blocked', 'failed', nil ] },
      last_run_details: { type: :object }, last_revaluation_id: { type: %i[integer null] },
      upcoming_runs: { type: :array, items: { type: :string } }
    },
    required: %w[id name rrule dtstart default_kind on_unapproved active]
  }

  path '/organizations/{organization_id}/accounting/currency_revaluation_schedules' do
    parameter name: :organization_id, in: :path, type: :integer, required: true

    post 'Create a revaluation schedule' do
      tags 'Currency Revaluation'
      consumes 'application/json'
      produces 'application/json'
      parameter name: :params, in: :body, schema: {
        type: :object,
        properties: {
          name: { type: :string }, rrule: { type: :string }, dtstart: { type: :string },
          default_kind: { type: :string, enum: %w[temporary permanent] },
          on_unapproved: { type: :string, enum: %w[skip post_temporary partial] },
          scope: { type: :object }, active: { type: :boolean }
        },
        required: %w[name rrule]
      }

      response '200', 'Created' do
        schema schedule_schema
        let(:params) { { name: 'Month end', rrule: 'FREQ=MONTHLY;BYMONTHDAY=-1', default_kind: 'permanent' } }

        before do
          grant(Permission::ACCOUNTING_REVALUE_CURRENCIES)
          travel_to Time.utc(2024, 6, 10, 12)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to include('default_kind' => 'permanent', 'on_unapproved' => 'partial', 'active' => true)
          expect(Time.iso8601(data['next_run_at'])).to eq(ActiveSupport::TimeZone['Asia/Tehran'].local(2024, 6, 30, 23))
          expect(data['upcoming_runs'].size).to eq(5)
        end
      end

      response '422', 'Invalid rule' do
        let(:params) { { name: 'Hourly', rrule: 'FREQ=HOURLY', on_unapproved: 'sometimes' } }

        before { grant(Permission::ACCOUNTING_REVALUE_CURRENCIES) }

        run_test! do |response|
          expect(JSON.parse(response.body)['errors'].join).to include('daily, weekly, monthly or yearly')
        end
      end

      response '403', 'Not authorized' do
        let(:params) { { name: 'Daily', rrule: 'FREQ=DAILY' } }

        before { grant(Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES) }

        run_test!
      end
    end

    get 'List revaluation schedules' do
      tags 'Currency Revaluation'
      produces 'application/json'

      response '200', 'Schedules' do
        schema type: :array, items: schedule_schema

        before do
          grant(Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES)
          create(:accounting_currency_revaluation_schedule, organization: organization)
        end

        run_test! do |response|
          expect(JSON.parse(response.body).size).to eq(1)
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/currency_revaluation_schedules/preview' do
    parameter name: :organization_id, in: :path, type: :integer, required: true

    post 'Validate a rule and list its next runs (nothing is saved)' do
      tags 'Currency Revaluation'
      consumes 'application/json'
      produces 'application/json'
      parameter name: :params, in: :body, schema: {
        type: :object,
        properties: {
          rrule: { type: :string },
          dtstart: { type: :string, description: 'Local date-time of the organization, e.g. 2024-06-01T23:00' }
        }
      }

      before do
        grant(Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES)
        travel_to Time.utc(2024, 6, 10, 12)
      end

      response '200', 'Preview' do
        schema type: :object,
               properties: {
                 valid: { type: :boolean }, errors: { type: :array, items: { type: :string } },
                 rrule: { type: %i[string null] }, dtstart: { type: %i[string null] },
                 upcoming_runs: { type: :array, items: { type: :string } }
               }
        let(:params) { { rrule: 'freq=weekly;byday=fr', dtstart: '2024-06-01T22:30' } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to include('valid' => true, 'rrule' => 'FREQ=WEEKLY;BYDAY=FR', 'dtstart' => '2024-06-01T22:30:00+03:30')
          expect(data['upcoming_runs'].first).to eq('2024-06-14T22:30:00+03:30')
          expect(Accounting::CurrencyRevaluationSchedule.count).to eq(0)
        end
      end

      response '200', 'Invalid rule' do
        let(:params) { { rrule: 'FREQ=MINUTELY' } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['valid']).to be(false)
          expect(data['upcoming_runs']).to eq([])
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/currency_revaluation_schedules/{id}/run_now' do
    parameter name: :organization_id, in: :path, type: :integer, required: true
    parameter name: :id, in: :path, type: :integer, required: true

    post 'Run a schedule now' do
      tags 'Currency Revaluation'
      produces 'application/json'

      response '200', 'Run outcome' do
        schema type: :object,
               properties: {
                 status: { type: :string, enum: %w[posted no_change skipped blocked failed] },
                 details: { type: :object },
                 revaluation_id: { type: %i[integer null] },
                 schedule: schedule_schema
               }
        let(:id) { create(:accounting_currency_revaluation_schedule, organization: organization).id }

        before { grant(Permission::ACCOUNTING_REVALUE_CURRENCIES) }

        run_test! do |response|
          data = JSON.parse(response.body)
          # The organization has no fiscal year for today.
          expect(data).to include('status' => 'skipped')
          expect(data['schedule']['last_run_status']).to eq('skipped')
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/currency_revaluation_schedules/{id}' do
    parameter name: :organization_id, in: :path, type: :integer, required: true
    parameter name: :id, in: :path, type: :integer, required: true

    patch 'Update a schedule' do
      tags 'Currency Revaluation'
      consumes 'application/json'
      produces 'application/json'
      parameter name: :params, in: :body, schema: { type: :object }

      response '200', 'Deactivated' do
        schema schedule_schema
        let(:id) { create(:accounting_currency_revaluation_schedule, organization: organization).id }
        let(:params) { { active: false } }

        before { grant(Permission::ACCOUNTING_REVALUE_CURRENCIES) }

        run_test! do |response|
          expect(JSON.parse(response.body)).to include('active' => false, 'next_run_at' => nil)
        end
      end
    end

    delete 'Delete a schedule (its revaluations are kept)' do
      tags 'Currency Revaluation'
      produces 'application/json'

      response '200', 'Deleted' do
        let(:id) { create(:accounting_currency_revaluation_schedule, organization: organization).id }

        before { grant(Permission::ACCOUNTING_REVALUE_CURRENCIES) }

        run_test! do
          expect(Accounting::CurrencyRevaluationSchedule.exists?(id)).to be(false)
        end
      end
    end
  end
end
