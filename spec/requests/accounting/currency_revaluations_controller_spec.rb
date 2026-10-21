require 'swagger_helper'

RSpec.describe 'Accounting::CurrencyRevaluations API', openapi_spec: 'v1/accounting.yaml', type: :request do
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
  let(:fx_gain) { create_account_in(organization, 'RE', ledger_code: '90', name: 'FX gain') }
  let(:other_gain) { create_account_in(organization, 'RE', ledger_code: '91', name: 'Other FX gain') }
  let(:fx_loss) { create_account_in(organization, 'EX', ledger_code: '90', name: 'FX loss') }
  let(:organization_id) { organization.id }

  before do
    sign_in user
    organization.accounting_setting.update!(default_fx_gain_account: fx_gain, default_fx_loss_account: fx_loss)
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 3, 1), lines: [
      je_line(bank, debit: 110, currency: eur, rate: 1.1), je_line(revenue, credit: 110)
    ])
    create(:accounting_exchange_rate, organization: organization, currency: eur, date: Date.new(2024, 6, 30), rate: '1.25')
  end

  def grant(code)
    create(:permission, code: code, grantee: member, organization: organization)
  end

  def draft!
    revaluation = Accounting::CurrencyRevaluation.create!(organization: organization, fiscal_year: fiscal_year,
                                                          as_of_date: Date.new(2024, 6, 30), created_by: member)
    Accounting::Revaluation::Preparer.new(revaluation).call
    revaluation
  end

  item_schema = {
    type: :object,
    properties: {
      id: { type: :integer }, account_id: { type: :integer }, currency_id: { type: :integer },
      center1_id: { type: %i[integer null] },
      currency_balance: { type: :string }, book_base_balance: { type: :string },
      rate: { type: %i[string null] }, rate_date: { type: %i[string null] },
      revalued_base_balance: { type: %i[string null] }, difference: { type: :string },
      gain_loss_account_id: { type: %i[integer null] }, excluded: { type: :boolean },
      removed: { type: :boolean, description: 'Left out by the user; not posted' },
      excluded_reason: { type: %i[string null],
                         enum: [ 'missing_rate', 'missing_fx_account', 'center_mismatch', 'blocked_by_unapproved', 'locked_by_permanent', nil ] }
    }
  }
  revaluation_schema = {
    type: :object,
    properties: {
      id: { type: :integer }, fiscal_year_id: { type: :integer }, as_of_date: { type: :string, format: :date },
      kind: { type: :string, enum: %w[temporary permanent] },
      status: { type: :string, enum: %w[draft posted superseded] },
      scope: { type: :object, description: 'account_ids, ledger_ids, currency_ids, center_ids, center1_ids..center6_ids' },
      journal_entry_id: { type: %i[integer null] }, journal_entry_no: { type: %i[string null] },
      journal_entry_ref: { type: %i[string null] },
      total_difference: { type: :string }, items_count: { type: :integer }, excluded_count: { type: :integer },
      removed_count: { type: :integer },
      line_description_template: { type: :object, description: '{ locale => template } for revalued balance lines' },
      counter_line_description_template: { type: :object, description: '{ locale => template } for gain/loss lines' },
      default_line_templates: { type: :object, description: 'Templates used for blank locales: { item: {...}, counter: {...} }' },
      items: { type: :array, items: item_schema }
    },
    required: %w[id as_of_date kind status scope]
  }
  error_schema = {
    type: :object,
    properties: {
      errors: { type: :array, items: { type: :string } },
      code: { type: :string }, details: { type: :object }
    }
  }

  path '/organizations/{organization_id}/accounting/currency_revaluations' do
    parameter name: :organization_id, in: :path, type: :integer, required: true

    post 'Create a draft revaluation (computes the preview)' do
      tags 'Currency Revaluation'
      consumes 'application/json'
      produces 'application/json'
      parameter name: :params, in: :body, schema: {
        type: :object,
        properties: {
          as_of_date: { type: :string, format: :date },
          kind: { type: :string, enum: %w[temporary permanent], default: 'temporary' },
          scope: { type: :object, example: { account_ids: [ 1 ], currency_ids: [ 2 ] } }
        }
      }

      response '200', 'Draft with items' do
        schema revaluation_schema
        let(:params) { { as_of_date: '2024-06-30', scope: { account_ids: [ bank.id ] } } }

        before { grant(Permission::ACCOUNTING_REVALUE_CURRENCIES) }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to include('status' => 'draft', 'kind' => 'temporary', 'total_difference' => '15.0')
          expect(data['items'].first).to include('account_id' => bank.id, 'difference' => '15.0',
                                                 'gain_loss_account_id' => fx_gain.id)
        end
      end

      response '200', 'Permanent draft flags combinations with unapproved entries' do
        schema revaluation_schema
        let(:params) { { as_of_date: '2024-06-30', kind: 'permanent' } }

        before do
          grant(Permission::ACCOUNTING_REVALUE_CURRENCIES)
          post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 6, 1), state: :booked, lines: [
            je_line(bank, debit: 11, currency: eur, rate: 1.1), je_line(revenue, credit: 11)
          ])
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['kind']).to eq('permanent')
          expect(data['items'].first).to include('excluded' => true, 'excluded_reason' => 'blocked_by_unapproved')
        end
      end

      response '422', 'No fiscal year for the date' do
        schema error_schema
        let(:params) { { as_of_date: '2030-01-01' } }

        before { grant(Permission::ACCOUNTING_REVALUE_CURRENCIES) }

        run_test! do |response|
          expect(JSON.parse(response.body)).to include('code' => 'no_fiscal_year')
        end
      end

      response '403', 'Viewing journal entries is not enough' do
        let(:params) { { as_of_date: '2024-06-30' } }

        before { grant(Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES) }

        run_test!
      end
    end

    get 'List revaluations' do
      tags 'Currency Revaluation'
      produces 'application/json'

      response '200', 'Revaluations' do
        schema type: :array, items: revaluation_schema

        before do
          grant(Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES)
          draft!
        end

        run_test! do |response|
          expect(JSON.parse(response.body).size).to eq(1)
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/currency_revaluations/{id}' do
    parameter name: :organization_id, in: :path, type: :integer, required: true
    parameter name: :id, in: :path, type: :integer, required: true

    get 'A revaluation with its items (view=print: data for printed reports)' do
      tags 'Currency Revaluation'
      produces 'application/json'
      parameter name: :view, in: :query, type: :string, required: false, enum: %w[show print]

      let(:revaluation) { draft! }
      let(:id) { revaluation.id }

      before { grant(Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES) }

      response '200', 'Print data' do
        let(:view) { 'print' }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to include('kind_name' => 'Temporary', 'total_difference' => 15.0, 'total_gain' => 15.0)
          expect(data['items'].first).to include('account_name' => 'Bank', 'currency' => 'EUR', 'difference' => 15.0,
                                                 'gain_loss_account_name' => 'FX gain')
          expect(data['items'].first['currency_balance_text']).to match(/\A-?[\d,]+\.\d{2}\z/)
        end
      end

      response '400', 'Unknown view' do
        let(:view) { 'other' }

        run_test!
      end
    end

    patch 'Update a draft (date/scope/kind rebuild items; items[] set gain/loss accounts or leave items out)' do
      tags 'Currency Revaluation'
      consumes 'application/json'
      produces 'application/json'
      parameter name: :params, in: :body, schema: {
        type: :object,
        properties: {
          as_of_date: { type: :string, format: :date },
          scope: { type: :object },
          items: { type: :array, items: { type: :object, properties: { id: { type: :integer },
                                                                      gain_loss_account_id: { type: %i[integer null] },
                                                                      removed: { type: :boolean } } } },
          line_description_template: { type: :object, description: '{ locale => template }' },
          counter_line_description_template: { type: :object, description: '{ locale => template }' }
        }
      }

      let(:revaluation) { draft! }
      let(:id) { revaluation.id }

      before { grant(Permission::ACCOUNTING_REVALUE_CURRENCIES) }

      response '200', 'Overrides a gain/loss account' do
        schema revaluation_schema
        let(:params) { { items: [ { id: revaluation.items.first.id, gain_loss_account_id: other_gain.id } ] } }

        run_test! do |response|
          expect(JSON.parse(response.body)['items'].first['gain_loss_account_id']).to eq(other_gain.id)
        end
      end

      response '200', 'Leaves an item out' do
        schema revaluation_schema
        let(:params) { { items: [ { id: revaluation.items.first.id, removed: true } ] } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to include('removed_count' => 1, 'total_difference' => '0.0')
          expect(data['items'].first).to include('removed' => true, 'gain_loss_account_id' => fx_gain.id)
        end
      end

      response '200', 'Sets the line description templates' do
        schema revaluation_schema
        # Languages the organization doesn't use are dropped.
        let(:params) { { line_description_template: { en: '{account_name} at {rate}', xx: 'ignored' } } }

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['line_description_template']).to eq('en' => '{account_name} at {rate}')
        end
      end

      response '422', 'Unknown template variable' do
        schema error_schema
        let(:params) { { counter_line_description_template: { en: 'Gain on {rate}' } } }

        run_test! do |response|
          expect(JSON.parse(response.body)['errors'].join).to include('{rate}')
        end
      end

      response '422', 'Gain/loss account must be an income statement account' do
        schema error_schema
        let(:params) { { items: [ { id: revaluation.items.first.id, gain_loss_account_id: bank.id } ] } }

        run_test!
      end
    end

    delete 'Delete a revaluation and its entry' do
      tags 'Currency Revaluation'
      produces 'application/json'

      response '200', 'Deleted' do
        let(:id) do
          Accounting::Revaluation::Poster.new(draft!, member: member).call.id
        end

        before { grant(Permission::ACCOUNTING_REVALUE_CURRENCIES) }

        run_test! do
          expect(Accounting::CurrencyRevaluation.exists?(id)).to be(false)
          expect(Accounting::JournalEntry.where(entry_type: :revaluation)).to be_empty
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/currency_revaluations/{id}/kind' do
    parameter name: :organization_id, in: :path, type: :integer, required: true
    parameter name: :id, in: :path, type: :integer, required: true

    patch 'Make a posted revaluation temporary or permanent' do
      tags 'Currency Revaluation'
      consumes 'application/json'
      produces 'application/json'
      parameter name: :params, in: :body, schema: {
        type: :object, properties: { kind: { type: :string, enum: %w[temporary permanent] } }, required: %w[kind]
      }

      let(:id) { Accounting::Revaluation::Poster.new(draft!, member: member).call.id }

      before { grant(Permission::ACCOUNTING_REVALUE_CURRENCIES) }

      response '200', 'Kind changed' do
        schema revaluation_schema
        let(:params) { { kind: 'permanent' } }

        run_test! do |response|
          expect(JSON.parse(response.body)['kind']).to eq('permanent')
        end
      end

      response '422', 'Not allowed' do
        schema error_schema
        let(:params) { { kind: 'permanent' } }

        before do
          id
          post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 6, 1), state: :booked, lines: [
            je_line(bank, debit: 11, currency: eur, rate: 1.1), je_line(revenue, credit: 11)
          ])
        end

        run_test! do |response|
          expect(JSON.parse(response.body)).to include('code' => 'unapproved_entries')
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/currency_revaluations/{id}/post' do
    parameter name: :organization_id, in: :path, type: :integer, required: true
    parameter name: :id, in: :path, type: :integer, required: true

    post 'Post a draft revaluation' do
      tags 'Currency Revaluation'
      produces 'application/json'

      let(:revaluation) { draft! }
      let(:id) { revaluation.id }

      before { grant(Permission::ACCOUNTING_REVALUE_CURRENCIES) }

      response '200', 'Posted' do
        schema revaluation_schema

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['status']).to eq('posted')
          expect(Accounting::JournalEntry.find(data['journal_entry_id'])).to be_revaluation
        end
      end

      response '409', 'Balances changed since the preview' do
        schema error_schema

        before do
          revaluation
          post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 6, 1), lines: [
            je_line(bank, debit: 11, currency: eur, rate: 1.1), je_line(revenue, credit: 11)
          ])
        end

        run_test! do |response|
          expect(JSON.parse(response.body)).to include('code' => 'stale')
        end
      end
    end
  end
end
