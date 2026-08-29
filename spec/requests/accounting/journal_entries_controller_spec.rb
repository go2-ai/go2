# spec/requests/accounting/journal_entries_controller_spec.rb
require 'swagger_helper'

RSpec.describe 'Accounting::JournalEntries API', openapi_spec: 'v1/accounting.yaml', type: :request do
  let(:organization) { create(:organization, active_locales: [ 'fa' ]) }
  let(:user) { create(:user) }
  let(:member) { create(:member, organization: organization, user: user) }

  let(:account_category) { organization.account_categories.find_by!(identifier: "CA") }
  let(:ledger) { create(:accounting_ledger, account_category: account_category, code: "10") }
  let(:account) { create(:accounting_account, ledger: ledger, code: "01", name: { en: "Cash" }) }

  let(:fiscal_year) do
    create(:fiscal_year, organization: organization,
           start_date: Date.new(2024, 1, 1),
           finish_date: Date.new(2024, 12, 31))
  end

  let(:main_currency) { organization.accounting_setting.main_currency }

  before { sign_in(user) }

  # ─── Schema definitions ──────────────────────────────────────────────────

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
      debit: { type: :number, format: :float, example: 100.0 },
      credit: { type: :number, format: :float, example: 0.0 },
      currency_id: { type: :integer, example: 1 },
      rate: { type: :number, format: :float, example: 1.0 },
      currency_amount: { type: :number, format: :float, example: 100.0 },
      account_code: { type: :string, example: '01' },
      account_name: { type: :string, example: 'Cash' },
      t: {
        type: :object,
        example: { description: { en: 'Cash debit', fa: 'بدهکار نقدی' } }
      }
    },
    required: %w[id row account_id debit credit currency_id rate currency_amount]
  }

  journal_entry_schema = {
    type: :object,
    properties: {
      id: { type: :integer, example: 1 },
      date: { type: :string, format: :date, example: '2024-06-15' },
      effective_date: { type: :string, format: :date, example: '2024-06-15' },
      fiscal_year_id: { type: :integer, example: 1 },
      no: { type: :string, example: '1' },
      ref: { type: :string, example: '1' },
      daily_no: { type: :integer, example: 1 },
      state: { type: :string, enum: %w[draft booked approved], example: 'draft' },
      entry_type: { type: :string, enum: %w[normal beginning ending], example: 'normal' },
      debit: { type: :number, format: :float, example: 100.0 },
      credit: { type: :number, format: :float, example: 100.0 },
      organization_id: { type: :integer, example: 1 },
      creator_id: { type: %i[integer nil], example: 1 },
      t: {
        type: :object,
        example: { description: { en: 'Opening Entry', fa: 'سند افتتاحیه' } }
      },
      items: {
        type: :array,
        items: journal_entry_item_schema
      }
    },
    required: %w[id date effective_date fiscal_year_id no ref daily_no state entry_type debit credit organization_id]
  }

  create_journal_entry_schema = {
    type: :object,
    properties: {
      date: { type: :string, format: :date, example: '2024-06-15' },
      effective_date: { type: :string, format: :date, example: '2024-06-15' },
      fiscal_year_id: { type: :integer, example: 1 },
      state: { type: :string, enum: %w[draft booked], example: 'draft' },
      entry_type: { type: :string, enum: %w[normal], example: 'normal' },
      description_en: { type: :string, example: 'Opening Entry' },
      description_fa: { type: :string, example: 'سند افتتاحیه' },
      items_attributes: {
        type: :array,
        items: {
          type: :object,
          properties: {
            id: { type: :integer, example: 1, description: 'Required for updates' },
            row: { type: :integer, example: 1 },
            account_id: { type: :integer, example: 1 },
            center1_id: { type: %i[integer nil], example: nil },
            center2_id: { type: %i[integer nil], example: nil },
            center3_id: { type: %i[integer nil], example: nil },
            center4_id: { type: %i[integer nil], example: nil },
            center5_id: { type: %i[integer nil], example: nil },
            center6_id: { type: %i[integer nil], example: nil },
            debit: { type: :number, example: 100.0 },
            credit: { type: :number, example: 0.0 },
            currency_id: { type: :integer, example: 1 },
            rate: { type: :number, example: 1.0 },
            currency_amount: { type: :number, example: 100.0 },
            description_en: { type: :string, example: 'Cash debit' },
            description_fa: { type: :string, example: 'بدهکار نقدی' },
            _destroy: { type: :boolean, example: false, description: 'Set true to delete this item' }
          }
        }
      }
    },
    required: %w[date fiscal_year_id]
  }

  # ─── Helper to create a journal entry in a given state ──────────────────

  def create_journal_entry_in_state(organization, fiscal_year, account, state)
    je = create(:accounting_journal_entry,
                organization: organization,
                fiscal_year: fiscal_year,
                date: Date.new(2024, 3, 1),
                state: :draft)

    je.items.create!(row: 1, account: account, debit: 100, credit: 0)
    je.items.create!(row: 2, account: account, debit: 0, credit: 100)
    je.update!(state: state)
    je
  end

  # ─── Paths ──────────────────────────────────────────────────────────────

  path '/organizations/{organization_id}/accounting/journal_entries' do
    parameter name: :organization_id, in: :path, type: :integer,
              description: 'Organization ID', required: true

    get 'Get all journal entries' do
      tags 'Journal Entries'
      produces 'application/json'
      parameter name: :fiscal_year_id, in: :query, type: :integer,
                description: 'Filter by fiscal year', required: false

      response '200', 'Loaded successfully' do
        schema type: :array, items: journal_entry_schema

        let(:organization_id) { organization.id }

        let!(:je1) do
          create(:accounting_journal_entry, organization: organization,
                 fiscal_year: fiscal_year, date: Date.new(2024, 3, 1))
        end
        let!(:je2) do
          create(:accounting_journal_entry, organization: organization,
                 fiscal_year: fiscal_year, date: Date.new(2024, 3, 2))
        end

        before do
          create(:permission, code: Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES,
                 grantee: member, organization: organization)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data.length).to eq(2)
          expect(data.map { |je| je['id'] }).to contain_exactly(je1.id, je2.id)
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        before { member }

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end

    post 'Create a journal entry' do
      tags 'Journal Entries'
      consumes 'application/json'
      produces 'application/json'
      parameter name: :params, in: :body, schema: create_journal_entry_schema

      response '200', 'Created successfully' do
        schema journal_entry_schema

        let(:organization_id) { organization.id }
        let(:params) do
          {
            date: '2024-06-15',
            effective_date: '2024-06-15',
            fiscal_year_id: fiscal_year.id,
            state: 'draft',
            entry_type: 'normal',
            description_en: 'Opening Entry',
            description_fa: 'سند افتتاحیه',
            items_attributes: [
              {
                row: 1,
                account_id: account.id,
                debit: 100,
                credit: 0,
                currency_id: main_currency.id,
                rate: 1.0,
                currency_amount: 100,
                description_en: 'Cash debit',
                description_fa: 'بدهکار نقدی'
              },
              {
                row: 2,
                account_id: account.id,
                debit: 0,
                credit: 100,
                currency_id: main_currency.id,
                rate: 1.0,
                currency_amount: 100,
                description_en: 'Cash credit',
                description_fa: 'بستانکار نقدی'
              }
            ]
          }
        end

        before do
          create(:permission, code: Permission::ACCOUNTING_MANAGE_JOURNAL_ENTRIES,
                 grantee: member, organization: organization)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to be > 0
          expect(data['state']).to eq('draft')
          expect(data['items'].length).to eq(2)
          expect(data['debit']).to eq(100.0)
          expect(data['credit']).to eq(100.0)
        end
      end

      response '422', 'Invalid request' do
        let(:organization_id) { organization.id }
        let(:params) do
          {
            date: nil,
            fiscal_year_id: fiscal_year.id
          }
        end

        before do
          create(:permission, code: Permission::ACCOUNTING_MANAGE_JOURNAL_ENTRIES,
                 grantee: member, organization: organization)
        end

        run_test! do |response|
          expect(response).to have_http_status(:unprocessable_content)
        end
      end

      response '403', 'Not authorized' do
        let(:organization_id) { organization.id }
        let(:params) { {} }

        before { member }

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/journal_entries/{id}' do
    parameter name: :organization_id, in: :path, type: :integer,
              description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer,
              description: 'Journal Entry ID', required: true

    let(:organization_id) { organization.id }

    get 'Show a journal entry' do
      tags 'Journal Entries'
      produces 'application/json'

      response '200', 'Loaded successfully' do
        schema journal_entry_schema

        let!(:je) do
          create(:accounting_journal_entry, organization: organization,
                 fiscal_year: fiscal_year, date: Date.new(2024, 3, 1))
        end
        let(:id) { je.id }

        before do
          create(:permission, code: Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES,
                 grantee: member, organization: organization)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to eq(je.id)
        end
      end

      response '404', 'Not found' do
        let(:id) { 999999 }

        before do
          create(:permission, code: Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES,
                 grantee: member, organization: organization)
        end

        run_test! do |response|
          expect(response).to have_http_status(:not_found)
        end
      end

      response '403', 'Not authorized' do
        let!(:je) do
          create(:accounting_journal_entry, organization: organization,
                 fiscal_year: fiscal_year, date: Date.new(2024, 3, 1))
        end
        let(:id) { je.id }

        before { member }

        run_test! do |response|
          expect(response).to have_http_status(:forbidden)
        end
      end
    end

    patch 'Update a journal entry' do
      tags 'Journal Entries'
      consumes 'application/json'
      produces 'application/json'
      parameter name: :params, in: :body, schema: create_journal_entry_schema

      response '200', 'Updated successfully' do
        schema journal_entry_schema

        let!(:je) do
          create(:accounting_journal_entry, organization: organization,
                 fiscal_year: fiscal_year, date: Date.new(2024, 3, 1))
        end
        let(:id) { je.id }
        let(:params) { { description_en: 'Updated Entry' } }

        before do
          create(:permission, code: Permission::ACCOUNTING_MANAGE_JOURNAL_ENTRIES,
                 grantee: member, organization: organization)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['id']).to eq(je.id)
          expect(data['t']['description']).to include('en' => 'Updated Entry')
        end
      end

      response '404', 'Not found' do
        let(:id) { 999999 }
        let(:params) { { description_en: 'Not Found' } }

        before do
          create(:permission, code: Permission::ACCOUNTING_MANAGE_JOURNAL_ENTRIES,
                 grantee: member, organization: organization)
        end

        run_test! do |response|
          expect(response).to have_http_status(:not_found)
        end
      end
    end

    delete 'Delete a journal entry' do
      tags 'Journal Entries'
      produces 'application/json'

      response '200', 'Deleted successfully' do
        schema journal_entry_schema

        let!(:je) do
          create(:accounting_journal_entry, organization: organization,
                 fiscal_year: fiscal_year, date: Date.new(2024, 3, 1))
        end
        let(:id) { je.id }

        before do
          create(:permission, code: Permission::ACCOUNTING_MANAGE_JOURNAL_ENTRIES,
                 grantee: member, organization: organization)
        end

        run_test! do |response|
          expect(Accounting::JournalEntry.find_by(id: je.id)).to be_nil
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/journal_entries/{id}/approve' do
    parameter name: :organization_id, in: :path, type: :integer,
              description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer,
              description: 'Journal Entry ID', required: true

    let(:organization_id) { organization.id }

    patch 'Approve a journal entry' do
      tags 'Journal Entries'
      produces 'application/json'

      response '200', 'Approved successfully' do
        schema journal_entry_schema

        let!(:je) do
          create_journal_entry_in_state(organization, fiscal_year, account, :booked)
        end
        let(:id) { je.id }

        before do
          create(:permission, code: Permission::ACCOUNTING_APPROVE_JOURNAL_ENTRIES,
                 grantee: member, organization: organization)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['state']).to eq('approved')
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/journal_entries/{id}/unapprove' do
    parameter name: :organization_id, in: :path, type: :integer,
              description: 'Organization ID', required: true
    parameter name: :id, in: :path, type: :integer,
              description: 'Journal Entry ID', required: true

    let(:organization_id) { organization.id }

    patch 'Unapprove a journal entry' do
      tags 'Journal Entries'
      produces 'application/json'

      response '200', 'Unapproved successfully' do
        schema journal_entry_schema

        let!(:je) do
          create_journal_entry_in_state(organization, fiscal_year, account, :approved)
        end
        let(:id) { je.id }

        before do
          create(:permission, code: Permission::ACCOUNTING_APPROVE_JOURNAL_ENTRIES,
                 grantee: member, organization: organization)
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['state']).to eq('booked')
        end
      end
    end
  end
end
