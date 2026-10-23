# spec/requests/accounting/journal_entry_items_controller_spec.rb
require 'swagger_helper'

RSpec.describe 'Accounting::JournalEntryItems API', openapi_spec: 'v1/accounting.yaml', type: :request do
  journal_entry_item_schema = {
    type: :object,
    properties: {
      id: { type: :integer, example: 1 },
      row: { type: :integer, example: 1 },
      account_id: { type: %i[integer nil], example: 1 },
      center1_id: { type: %i[integer nil], example: nil },
      center2_id: { type: %i[integer nil], example: nil },
      center3_id: { type: %i[integer nil], example: nil },
      center4_id: { type: %i[integer nil], example: nil },
      center5_id: { type: %i[integer nil], example: nil },
      center6_id: { type: %i[integer nil], example: nil },
      debit: { type: :number, format: :float, example: 5000.0 },
      credit: { type: :number, format: :float, example: 0.0 },
      currency_id: { type: %i[integer nil], example: 1 },
      rate: { type: %i[number nil], format: :float, example: 1.0 },
      currency_amount: { type: :number, format: :float, example: 5000.0 },
      account_code: { type: :string, example: '01' },
      account_name: { type: :string, example: 'Bank' },
      t: {
        type: :object,
        example: { description: { en: 'Description', fa: 'توضیحات' } }
      },
      journal_entry: {
        type: :object,
        properties: {
          id: { type: :integer, example: 1 },
          date: { type: :string, format: :date, example: '2024-01-15' },
          no: { type: :string, example: '1' },
          ref: { type: :string, example: '1' }
        }
      }
    },
    required: %w[id row account_id debit credit currency_id rate currency_amount]
  }

  filter_schema = {
    type: :object,
    properties: {
      dimension: { type: :string, example: 'account' },
      ids: { type: :array, items: { type: :integer }, example: [ 1 ] }
    },
    required: %w[dimension ids]
  }

  group_summary_schema = {
    type: :object,
    properties: {
      group_by: { type: :string, example: 'ledger' },
      rows: {
        type: :array,
        items: {
          type: :object,
          properties: {
            id: { type: :integer, example: 1 },
            code: { type: :string, example: '110' },
            name: { type: :string, example: 'Cash' },
            sum_debit: { type: :number, format: :float, example: 5000.0 },
            sum_credit: { type: :number, format: :float, example: 0.0 },
            debit_balance: { type: %i[number nil], example: 5000.0 },
            credit_balance: { type: %i[number nil], example: nil }
          }
        }
      },
      meta: {
        type: :object,
        properties: {
          from: { type: :string, format: :date, example: '2024-01-01' },
          to: { type: :string, format: :date, example: '2024-12-31' },
          fiscal_year_ids: { type: :array, items: { type: :integer }, example: [ 1 ] },
          multi_year: { type: :boolean, example: false },
          prior_entries_excluded: { type: :boolean, example: false }
        },
        required: %w[from to fiscal_year_ids multi_year prior_entries_excluded]
      }
    },
    required: %w[group_by rows meta]
  }

  # Period, entry type and state params shared by both endpoints.
  scope_parameters = lambda do |context|
    context.parameter name: :from, in: :query, schema: { type: :string, format: :date }, required: false,
                      description: 'Start of the period (YYYY-MM-DD). With `to`, replaces the fiscal year range.'
    context.parameter name: :to, in: :query, schema: { type: :string, format: :date }, required: false,
                      description: 'End of the period (YYYY-MM-DD).'
    context.parameter name: :entry_types, in: :query, type: :string, required: false,
                      description: 'Comma separated entry types (normal, beginning, revaluation, ' \
                                   'closing_temp_accounts, ending). Default: normal,beginning,revaluation. ' \
                                   'When the period spans several fiscal years, closing_temp_accounts and ending ' \
                                   'are ignored and beginning only selects the first year\'s beginning entry.'
    context.parameter name: :include_year_end, in: :query, type: :boolean, required: false,
                      description: 'Periods spanning several fiscal years: also include the temporary closing, ' \
                                   'ending and later beginning entries.'
    context.parameter name: :approved_only, in: :query, type: :boolean, required: false,
                      description: 'Only approved entries (default: booked and approved).'
  end

  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let(:member) { create(:member, organization: organization, user: user) }
  let(:fiscal_year) do
    create(:fiscal_year, organization: organization,
           start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31))
  end

  let(:category) { organization.account_categories.find_by!(identifier: 'CA') }
  let(:ledger)   { create(:accounting_ledger, account_category: category, code: '10') }
  let(:bank)     { create(:accounting_account, ledger: ledger, code: '01', name: { en: 'Bank' }) }
  let(:cash)     { create(:accounting_account, ledger: ledger, code: '02', name: { en: 'Cash' }) }

  let!(:journal_entry) do
    je = create(:accounting_journal_entry, organization: organization,
                fiscal_year: fiscal_year, date: Date.new(2024, 3, 1), state: :draft)
    je.items.create!(row: 1, account: bank, debit: 5000, credit: 0)
    je.items.create!(row: 2, account: cash, debit: 0, credit: 5000)
    je.update!(state: :booked)
    je
  end

  # A year-end entry: left out unless its entry type is selected.
  def create_ending_entry(amount)
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 12, 31), entry_type: :ending,
               source: fiscal_year, system_context: :fiscal_year_closing,
               lines: [ je_line(cash, debit: amount), je_line(bank, credit: amount) ])
  end

  before do
    sign_in(user)
    create(:permission, code: Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES,
           grantee: member, organization: organization)
  end

  path '/organizations/{organization_id}/accounting/journal_entry_items' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :fiscal_year_id, in: :query, type: :integer, description: 'Fiscal Year ID', required: false
    parameter name: 'filters[][dimension]', in: :query, type: :string, description: 'Filter dimension', required: false
    parameter name: 'filters[][ids][]', in: :query, type: :array, items: { type: :integer }, description: 'Filter IDs', required: false
    scope_parameters.call(self)

    get 'Get all journal entry items (explorer)' do
      tags 'Journal Entry Items'
      produces 'application/json'
      description 'Returns the flat, ungrouped journal_entry_items matching the explorer filters, period, ' \
                  'entry types and states. Drafts are never included.'

      response '200', 'Loaded successfully' do
        schema type: :array, items: journal_entry_item_schema

        let(:organization_id) { organization.id }
        let(:fiscal_year_id) { fiscal_year.id }

        run_test! do |response|
          body = JSON.parse(response.body)
          expect(body.size).to eq(2)
          expect(body.map { |i| i['account_code'] }).to contain_exactly('01', '02')
        end
      end

      response '200', 'Returns flat item list filtered by account' do
        schema type: :array, items: journal_entry_item_schema

        let(:organization_id) { organization.id }
        let(:fiscal_year_id) { fiscal_year.id }
        let('filters[][dimension]') { 'account' }
        let('filters[][ids][]') { [ bank.id ] }

        run_test! do |response|
          body = JSON.parse(response.body)
          expect(body.size).to eq(1)
          expect(body.first['account_code']).to eq('01')
          expect(body.first['debit']).to eq(5000.0)
        end
      end

      response '200', 'Excludes draft entries from results' do
        schema type: :array, items: journal_entry_item_schema

        let(:organization_id) { organization.id }
        let(:fiscal_year_id) { fiscal_year.id }

        before do
          draft_je = create(:accounting_journal_entry, organization: organization,
                             fiscal_year: fiscal_year, date: Date.new(2024, 3, 2), state: :draft)
          draft_je.items.create!(row: 1, account: bank, debit: 999, credit: 0)
        end

        run_test! do |response|
          body = JSON.parse(response.body)
          expect(body.map { |i| i['debit'] }).not_to include(999.0)
        end
      end

      response '200', 'Excludes year-end entries by default' do
        schema type: :array, items: journal_entry_item_schema

        let(:organization_id) { organization.id }
        let(:fiscal_year_id) { fiscal_year.id }

        before { create_ending_entry(777) }

        run_test! do |response|
          body = JSON.parse(response.body)
          expect(body.size).to eq(2)
          expect(body.map { |i| i['debit'] }).not_to include(777.0)
        end
      end

      response '200', 'Includes the selected entry types within a date range' do
        schema type: :array, items: journal_entry_item_schema

        let(:organization_id) { organization.id }
        let(:from) { '2024-06-01' }
        let(:to) { '2024-12-31' }
        let(:entry_types) { 'normal,ending' }

        before { create_ending_entry(777) }

        run_test! do |response|
          body = JSON.parse(response.body)
          expect(body.map { |i| i['debit'] }).to contain_exactly(777.0, 0.0)
          expect(body.map { |i| i['journal_entry']['date'] }.uniq).to eq([ '2024-12-31' ])
        end
      end

      response '200', 'Limits items to approved entries' do
        schema type: :array, items: journal_entry_item_schema

        let(:organization_id) { organization.id }
        let(:fiscal_year_id) { fiscal_year.id }
        let(:approved_only) { true }

        run_test! do |response|
          expect(JSON.parse(response.body)).to be_empty
        end
      end

      response '422', 'Invalid period' do
        let(:organization_id) { organization.id }
        let(:from) { '2024-05-01' }
        let(:to) { '2024-04-01' }

        run_test! do |response|
          expect(JSON.parse(response.body)['errors']).to eq([ 'The start date must be on or before the end date' ])
        end
      end

      response '422', 'Period outside the fiscal years' do
        let(:organization_id) { organization.id }
        let(:from) { '2023-12-01' }
        let(:to) { '2024-04-01' }

        run_test! do |response|
          expect(JSON.parse(response.body)['errors'].first).to include('2024-01-01', '2024-12-31')
        end
      end

      response '422', 'Malformed date' do
        let(:organization_id) { organization.id }
        let(:from) { '2024-13-45' }
        let(:to) { '2024-04-01' }

        run_test! do |response|
          expect(JSON.parse(response.body)['errors']).to eq([ 'Dates must be in YYYY-MM-DD format' ])
        end
      end

      response '422', 'Invalid filter dimension' do
        let(:organization_id) { organization.id }
        let(:fiscal_year_id) { fiscal_year.id }
        let('filters[][dimension]') { 'bogus' }
        let('filters[][ids][]') { [ 1 ] }

        run_test! do |response|
          expect(response).to have_http_status(:unprocessable_content)
          expect(JSON.parse(response.body)['errors']).to be_present
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/journal_entry_items/group_by' do
    parameter name: :organization_id, in: :path, type: :integer, description: 'Organization ID', required: true
    parameter name: :fiscal_year_id, in: :query, type: :integer, description: 'Fiscal Year ID', required: false
    parameter name: :group_by, in: :query, type: :string, enum: %w[account_category ledger account center1 center2 center3 center4 center5 center6 currency], description: 'Dimension to group by', required: true
    parameter name: 'filters[][dimension]', in: :query, type: :string, description: 'Filter dimension', required: false
    parameter name: 'filters[][ids][]', in: :query, type: :array, items: { type: :integer }, description: 'Filter IDs', required: false
    scope_parameters.call(self)
    parameter name: :hide_zero_balance, in: :query, type: :boolean, required: false,
              description: 'Leave out rows whose debit and credit net to zero.'

    get 'Get grouped summary of journal entry items' do
      tags 'Journal Entry Items'
      produces 'application/json'
      description 'Returns grouped summaries (debit/credit/net) for the explorer, for the period, entry types and ' \
                  'states, and the resolved period in `meta`. Drafts are never included.'

      response '200', 'Groups by ledger' do
        schema group_summary_schema

        let(:organization_id) { organization.id }
        let(:fiscal_year_id) { fiscal_year.id }
        let(:group_by) { 'ledger' }

        run_test! do |response|
          body = JSON.parse(response.body)
          expect(body['rows'].first['code']).to eq('110')
          expect(body['rows'].first['sum_debit']).to eq(5000.0)
        end
      end

      response '200', 'Drills into currency filtered by a selected account' do
        schema group_summary_schema

        let(:organization_id) { organization.id }
        let(:fiscal_year_id) { fiscal_year.id }
        let(:group_by) { 'currency' }
        let('filters[][dimension]') { 'account' }
        let('filters[][ids][]') { [ bank.id ] }

        run_test! do |response|
          body = JSON.parse(response.body)
          expect(body['rows'].first['sum_debit']).to eq(5000.0)
          expect(body['rows'].first['sum_credit']).to eq(0.0)
          expect(body['rows'].first['debit_balance']).to eq(5000.0)
        end
      end

      response '200', 'Reports the resolved period' do
        schema group_summary_schema

        let(:organization_id) { organization.id }
        let(:group_by) { 'account' }
        let(:from) { '2024-02-01' }
        let(:to) { '2024-12-31' }

        run_test! do |response|
          expect(JSON.parse(response.body)['meta']).to eq(
            'from' => '2024-02-01', 'to' => '2024-12-31', 'fiscal_year_ids' => [ fiscal_year.id ],
            'multi_year' => false, 'prior_entries_excluded' => true
          )
        end
      end

      response '200', 'Hides zero-balance rows' do
        schema group_summary_schema

        let(:organization_id) { organization.id }
        let(:fiscal_year_id) { fiscal_year.id }
        let(:group_by) { 'account' }
        let(:hide_zero_balance) { true }

        # Moves the 5,000 back from bank to cash: both accounts net to zero.
        before do
          post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 4, 1),
                     lines: [ je_line(cash, debit: 5000), je_line(bank, credit: 5000) ])
        end

        run_test! do |response|
          expect(JSON.parse(response.body)['rows']).to be_empty
        end
      end

      response '422', 'Invalid group_by dimension' do
        let(:organization_id) { organization.id }
        let(:fiscal_year_id) { fiscal_year.id }
        let(:group_by) { 'bogus' }

        run_test! do |response|
          expect(response).to have_http_status(:unprocessable_content)
          expect(JSON.parse(response.body)['errors']).to be_present
        end
      end

      response '422', 'Invalid filter dimension' do
        let(:organization_id) { organization.id }
        let(:fiscal_year_id) { fiscal_year.id }
        let(:group_by) { 'ledger' }
        let('filters[][dimension]') { 'bogus' }
        let('filters[][ids][]') { [ 1 ] }

        run_test! do |response|
          expect(response).to have_http_status(:unprocessable_content)
          expect(JSON.parse(response.body)['errors']).to be_present
        end
      end
    end
  end
end
