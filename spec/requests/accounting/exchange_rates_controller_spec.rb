require 'swagger_helper'

RSpec.describe 'Accounting::ExchangeRates API', openapi_spec: 'v1/accounting.yaml', type: :request do
  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let(:member) { create(:member, organization: organization, user: user) }
  let(:usd) { organization.accounting_setting.main_currency }
  let(:eur) { create(:accounting_currency, organization: organization, abr: 'EUR') }
  let(:gbp) { create(:accounting_currency, organization: organization, abr: 'GBP') }
  let(:organization_id) { organization.id }

  before { sign_in user }

  def grant(code)
    create(:permission, code: code, grantee: member, organization: organization)
  end

  exchange_rate_schema = {
    type: :object,
    properties: {
      id: { type: :integer },
      currency_id: { type: :integer },
      quote_currency_id: { type: %i[integer null], description: 'Blank = main currency' },
      date: { type: :string, format: :date },
      rate: { type: :string, example: '1.085', description: '1 unit of currency = rate units of the quote currency' },
      source: { type: :string, enum: %w[manual ecb] },
      meta: { type: :object },
      created_by_id: { type: %i[integer null] }
    },
    required: %w[id currency_id date rate source]
  }

  path '/organizations/{organization_id}/accounting/exchange_rates' do
    parameter name: :organization_id, in: :path, type: :integer, required: true

    get 'List exchange rates' do
      tags 'Exchange Rates'
      produces 'application/json'
      parameter name: :currency_id, in: :query, type: :integer, required: false
      parameter name: :from, in: :query, type: :string, format: :date, required: false
      parameter name: :to, in: :query, type: :string, format: :date, required: false

      response '200', 'Rates, newest first' do
        schema type: :array, items: exchange_rate_schema

        let(:from) { '2024-01-02' }

        before do
          grant(Permission::ACCOUNTING_VIEW_EXCHANGE_RATES)
          create(:accounting_exchange_rate, currency: eur, date: Date.new(2024, 1, 1), rate: '1.1')
          create(:accounting_exchange_rate, currency: eur, date: Date.new(2024, 1, 3), rate: '1.2')
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.map { |r| r['rate'] }).to eq([ '1.2' ])
        end
      end

      response '403', 'Not authorized' do
        before { member }

        run_test!
      end
    end

    post 'Add a manual exchange rate' do
      tags 'Exchange Rates'
      consumes 'application/json'
      produces 'application/json'
      parameter name: :params, in: :body, schema: {
        type: :object,
        properties: {
          currency_id: { type: :integer },
          quote_currency_id: { type: %i[integer null] },
          date: { type: :string, format: :date },
          rate: { type: :string, example: '1.085' }
        },
        required: %w[currency_id date rate]
      }

      response '200', 'Created' do
        schema exchange_rate_schema

        let(:params) { { currency_id: eur.id, date: '2024-01-02', rate: '1.0855' } }

        before { grant(Permission::ACCOUNTING_MANAGE_EXCHANGE_RATES) }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to include('source' => 'manual', 'rate' => '1.0855', 'created_by_id' => member.id)
        end
      end

      response '422', 'Invalid' do
        let(:params) { { currency_id: usd.id, date: '2024-01-02', rate: '1' } }

        before { grant(Permission::ACCOUNTING_MANAGE_EXCHANGE_RATES) }

        run_test! do |response|
          expect(JSON.parse(response.body)['errors'].join).to include('main currency')
        end
      end

      response '403', 'Viewing is not enough' do
        let(:params) { { currency_id: eur.id, date: '2024-01-02', rate: '1.0855' } }

        before { grant(Permission::ACCOUNTING_VIEW_EXCHANGE_RATES) }

        run_test!
      end
    end
  end

  path '/organizations/{organization_id}/accounting/exchange_rates/{id}' do
    parameter name: :organization_id, in: :path, type: :integer, required: true
    parameter name: :id, in: :path, type: :integer, required: true

    patch 'Update a manual exchange rate' do
      tags 'Exchange Rates'
      consumes 'application/json'
      produces 'application/json'
      parameter name: :params, in: :body, schema: {
        type: :object, properties: { rate: { type: :string }, date: { type: :string, format: :date } }
      }

      let(:params) { { rate: '1.3' } }

      before { grant(Permission::ACCOUNTING_MANAGE_EXCHANGE_RATES) }

      response '200', 'Updated' do
        schema exchange_rate_schema

        let(:id) { create(:accounting_exchange_rate, currency: eur).id }

        run_test! do |response|
          expect(JSON.parse(response.body)['rate']).to eq('1.3')
        end
      end

      response '422', 'Provider rates are read-only' do
        let(:id) { create(:accounting_exchange_rate, currency: eur, source: 'ecb').id }

        run_test! do |response|
          expect(JSON.parse(response.body)['errors'].join).to include("can't be edited")
        end
      end
    end

    delete 'Delete an exchange rate' do
      tags 'Exchange Rates'
      produces 'application/json'

      response '200', 'Deleted' do
        let(:id) { create(:accounting_exchange_rate, currency: eur, source: 'ecb').id }

        before { grant(Permission::ACCOUNTING_MANAGE_EXCHANGE_RATES) }

        run_test! do
          expect(Accounting::ExchangeRate.exists?(id)).to be(false)
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/exchange_rates/resolve' do
    parameter name: :organization_id, in: :path, type: :integer, required: true

    get 'Rates in the main currency on a date (with cross rates)' do
      tags 'Exchange Rates'
      produces 'application/json'
      parameter name: :date, in: :query, type: :string, format: :date, required: false,
                description: "Default: today in the organization's time zone"

      response '200', 'Resolved rates' do
        schema type: :object,
               properties: {
                 date: { type: :string, format: :date },
                 main_currency_id: { type: :integer },
                 rates: {
                   type: :array,
                   items: {
                     type: :object,
                     properties: {
                       currency_id: { type: :integer },
                       rate: { type: %i[string null] },
                       rate_date: { type: %i[string null], format: :date },
                       sources: { type: :array, items: { type: :string } },
                       path: { type: :array, items: exchange_rate_schema },
                       error: { type: %i[string null], enum: [ 'missing', 'cycle', nil ] }
                     }
                   }
                 }
               }

        let(:date) { '2024-01-05' }

        before do
          grant(Permission::ACCOUNTING_VIEW_EXCHANGE_RATES)
          create(:accounting_exchange_rate, currency: eur, date: Date.new(2024, 1, 4), rate: '1.1')
          gbp
        end

        run_test! do |response|
          rates = JSON.parse(response.body)['rates'].index_by { |r| r['currency_id'] }
          expect(rates[eur.id]).to include('rate' => '1.1', 'rate_date' => '2024-01-04', 'error' => nil)
          expect(rates[gbp.id]).to include('rate' => nil, 'error' => 'missing')
          expect(rates).not_to have_key(usd.id)
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/exchange_rates/fetch' do
    parameter name: :organization_id, in: :path, type: :integer, required: true

    post 'Fetch provider rates now (latest day, or backfill a range)' do
      tags 'Exchange Rates'
      produces 'application/json'
      parameter name: :from, in: :query, type: :string, format: :date, required: false
      parameter name: :to, in: :query, type: :string, format: :date, required: false

      before do
        travel_to Time.utc(2026, 10, 19, 15)
        create(:accounting_exchange_rate_source, organization: organization, currency: eur, provider: 'ecb')
      end

      response '200', 'Fetch summary' do
        schema type: :object,
               properties: {
                 created: { type: :integer }, updated: { type: :integer }, unchanged: { type: :integer },
                 dates: { type: :array, items: { type: :string, format: :date } },
                 skipped: {
                   type: :array,
                   items: {
                     type: :object,
                     properties: {
                       currency_id: { type: :integer }, currency: { type: :string },
                       reason: { type: :string, enum: %w[not_published] },
                       codes: { type: :array, items: { type: :string } }
                     }
                   }
                 }
               }

        before do
          grant(Permission::ACCOUNTING_MANAGE_EXCHANGE_RATES)
          stub_ecb(:daily)
        end

        run_test! do |response|
          expect(JSON.parse(response.body)).to include('created' => 1, 'dates' => [ '2026-10-16' ])
        end
      end

      response '422', 'Range too long' do
        let(:from) { '2020-01-01' }
        let(:to) { '2026-01-01' }

        before { grant(Permission::ACCOUNTING_MANAGE_EXCHANGE_RATES) }

        run_test!
      end

      response '502', 'Provider unavailable' do
        before do
          grant(Permission::ACCOUNTING_MANAGE_EXCHANGE_RATES)
          stub_ecb(:daily, status: 503)
        end

        run_test! do |response|
          expect(JSON.parse(response.body)['errors'].join).to include('could not be reached')
        end
      end

      response '403', 'Viewing is not enough' do
        before { grant(Permission::ACCOUNTING_VIEW_EXCHANGE_RATES) }

        run_test!
      end
    end
  end

  path '/organizations/{organization_id}/accounting/exchange_rate_sources' do
    parameter name: :organization_id, in: :path, type: :integer, required: true

    post 'Configure where a currency’s rates come from' do
      tags 'Exchange Rates'
      consumes 'application/json'
      produces 'application/json'
      parameter name: :params, in: :body, schema: {
        type: :object,
        properties: {
          currency_id: { type: :integer },
          provider: { type: :string, enum: %w[manual ecb] },
          quote_currency_id: { type: %i[integer null] },
          active: { type: :boolean }
        },
        required: %w[currency_id provider]
      }

      response '200', 'Created' do
        schema type: :object,
               properties: {
                 id: { type: :integer }, currency_id: { type: :integer },
                 provider: { type: :string }, quote_currency_id: { type: %i[integer null] }, active: { type: :boolean }
               }

        let(:params) { { currency_id: gbp.id, provider: 'ecb', quote_currency_id: eur.id } }

        before { grant(Permission::ACCOUNTING_MANAGE_EXCHANGE_RATES) }

        run_test! do |response|
          expect(JSON.parse(response.body)).to include('provider' => 'ecb', 'quote_currency_id' => eur.id)
        end
      end

      response '422', 'One source per currency' do
        let(:params) { { currency_id: gbp.id, provider: 'ecb' } }

        before do
          grant(Permission::ACCOUNTING_MANAGE_EXCHANGE_RATES)
          create(:accounting_exchange_rate_source, currency: gbp)
        end

        run_test!
      end
    end

    get 'List exchange rate sources' do
      tags 'Exchange Rates'
      produces 'application/json'

      response '200', 'Sources' do
        before do
          grant(Permission::ACCOUNTING_VIEW_EXCHANGE_RATES)
          create(:accounting_exchange_rate_source, currency: eur, provider: 'ecb')
        end

        run_test! do |response|
          expect(JSON.parse(response.body).map { |s| s['currency_id'] }).to eq([ eur.id ])
        end
      end
    end
  end
end
