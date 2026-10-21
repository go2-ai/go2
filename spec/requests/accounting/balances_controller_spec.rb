require 'swagger_helper'

RSpec.describe 'Accounting::Balances API', openapi_spec: 'v1/accounting.yaml', type: :request do
  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let(:member) { create(:member, organization: organization, user: user) }
  let(:eur) { create(:accounting_currency, organization: organization, abr: 'EUR') }
  let(:fiscal_year) do
    create(:fiscal_year, organization: organization,
           start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31))
  end
  let(:bank) { create_account_in(organization, 'CA', ledger_code: '10', monetary: true, name: 'Bank') }
  let(:revenue) { create_account_in(organization, 'RE', ledger_code: '10', name: 'Sales') }

  before do
    sign_in user
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 3, 1), lines: [
      je_line(bank, debit: 110, currency: eur, rate: 1.1),
      je_line(revenue, credit: 110)
    ])
  end

  balance_row_schema = {
    type: :object,
    properties: {
      account_id: { type: :integer },
      account_code: { type: %i[string null] },
      account_name: { type: %i[string null] },
      centers: {
        type: :array,
        items: {
          type: :object,
          properties: {
            level: { type: :integer, example: 1 },
            id: { type: :integer },
            code: { type: %i[string null] },
            name: { type: %i[string null] }
          }
        }
      },
      currency_id: { type: :integer },
      currency_abr: { type: %i[string null], example: 'EUR' },
      debit: { type: :string, example: '110.0', description: 'Decimal string' },
      credit: { type: :string, example: '0.0' },
      base_balance: { type: :string, example: '110.0', description: 'Σ debit − Σ credit in the main currency' },
      currency_balance: { type: :string, example: '100.0', description: 'Signed balance in the item currency' }
    },
    required: %w[account_id centers currency_id debit credit base_balance currency_balance]
  }

  path '/organizations/{organization_id}/accounting/balances' do
    parameter name: :organization_id, in: :path, type: :integer, required: true
    parameter name: :fiscal_year_id, in: :query, type: :integer, required: true
    parameter name: :as_of, in: :query, type: :string, format: :date, required: false,
              description: 'Only entries dated on or before this date'
    parameter name: :monetary_only, in: :query, type: :boolean, required: false
    parameter name: :foreign_only, in: :query, type: :boolean, required: false,
              description: 'Exclude the main currency'
    parameter name: :approved_only, in: :query, type: :boolean, required: false
    parameter name: 'category_types[]', in: :query, type: :array, items: { type: :string },
              required: false, description: 'balance_sheet, income_statement, other'

    let(:organization_id) { organization.id }
    let(:fiscal_year_id) { fiscal_year.id }

    get 'Balances grouped by account, centers and currency' do
      tags 'Balances'
      produces 'application/json'

      response '200', 'Balances' do
        schema type: :object, properties: { rows: { type: :array, items: balance_row_schema } }

        let(:foreign_only) { true }

        before do
          create(:permission, code: Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES,
                 grantee: member, organization: organization)
        end

        run_test! do |response|
          rows = JSON.parse(response.body)['rows']
          expect(rows.size).to eq(1)
          expect(rows.first).to include(
            'account_id' => bank.id, 'currency_abr' => 'EUR',
            'base_balance' => '110.0', 'currency_balance' => '100.0'
          )
        end
      end

      response '422', 'Missing fiscal year' do
        let(:fiscal_year_id) { 0 }

        before do
          create(:permission, code: Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES,
                 grantee: member, organization: organization)
        end

        run_test! do |response|
          expect(JSON.parse(response.body)['errors']).to eq([ 'Select a valid fiscal year' ])
        end
      end

      response '422', 'Invalid date' do
        let(:as_of) { '31/12/2024' }

        before do
          create(:permission, code: Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES,
                 grantee: member, organization: organization)
        end

        run_test!
      end

      response '403', 'Not authorized' do
        before { member }

        run_test!
      end
    end
  end
end
