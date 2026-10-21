require 'swagger_helper'

RSpec.describe 'Accounting::FiscalYearClosings API', openapi_spec: 'v1/accounting.yaml', type: :request do
  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let(:member) { create(:member, organization: organization, user: user) }
  let!(:fiscal_year) do
    create(:fiscal_year, organization: organization,
           start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31))
  end
  let!(:next_year) do
    create(:fiscal_year, organization: organization,
           start_date: Date.new(2025, 1, 1), finish_date: Date.new(2025, 12, 31))
  end
  let(:bank) { create_account_in(organization, 'CA', ledger_code: '10', monetary: true) }
  let(:revenue) { create_account_in(organization, 'RE', ledger_code: '10') }
  let(:organization_id) { organization.id }
  let(:id) { fiscal_year.id }

  before do
    sign_in user
    organization.accounting_setting.update!(retained_earnings_account: create_account_in(organization, 'OE', ledger_code: '30'))
  end

  def grant(*codes)
    codes.each { |code| create(:permission, code: code, grantee: member, organization: organization) }
  end

  def booked_entry!
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 3, 1), state: :booked,
               lines: [ je_line(bank, debit: 10), je_line(revenue, credit: 10) ])
  end

  year_schema = {
    type: :object,
    properties: {
      id: { type: :integer }, name: { type: :string },
      start_date: { type: :string, format: :date }, finish_date: { type: :string, format: :date },
      status: { type: :string, enum: %w[open closing closed] },
      closing_step: { type: %i[string null] }
    }
  }
  state_schema = {
    type: :object,
    properties: {
      fiscal_year: year_schema,
      steps: { type: :array, items: { type: :string } },
      current_step: { type: :string, enum: %w[readiness renumber revaluation temp_closing ending beginning finalized] },
      settings: { type: %i[object null] },
      readiness: {
        type: %i[object null],
        description: 'Only while the year is open',
        properties: {
          ready: { type: :boolean },
          blockers: { type: :array, items: { type: :string,
                                             enum: %w[not_open drafts unapproved_entries no_next_fiscal_year
                                                      next_fiscal_year_not_open previous_fiscal_year_open settings_incomplete] } },
          drafts_count: { type: :integer },
          booked_count: { type: :integer }, approved_count: { type: :integer },
          next_fiscal_year: { oneOf: [ year_schema, { type: :null } ] },
          settings_errors: { type: :array, items: { type: :string } }
        }
      },
      revaluation_check: {
        type: %i[object null],
        description: 'Only at the revaluation step: dry run of a permanent revaluation as of the last day',
        properties: {
          as_of_date: { type: :string, format: :date },
          passes: { type: :boolean }, clean: { type: :boolean }, acknowledged: { type: :boolean },
          acknowledgment: { type: %i[object null] },
          total_difference: { type: :string },
          temporaries: { type: :array, items: { type: :object } },
          unrevalued: { type: :array, items: { type: :object } },
          missing_rates: { type: :array, items: { type: :object } },
          other_exclusions: { type: :array, items: { type: :object } }
        }
      },
      temp_closing: {
        type: %i[object null],
        description: 'Only at the temp_closing step: preview of the entries closing the income statement accounts',
        properties: {
          closing_method: { type: :string, enum: %w[direct income_summary current_year_profit] },
          net_result: { type: :string, description: 'Profit (positive) or loss (negative) of the year' },
          checksum: { type: :string }, postable: { type: :boolean },
          entries: {
            type: :array,
            items: {
              type: :object,
              properties: {
                kind: { type: :string, enum: %w[close_accounts close_income_summary] },
                target_account_id: { type: :integer }, total: { type: :string },
                lines: { type: :array, items: { type: :object } }
              }
            }
          },
          problems: { type: :array, items: { type: :object } }
        }
      },
      ending: {
        type: %i[object null],
        description: 'Only at the ending step: preview of the ending entry (reverses every permanent balance)',
        properties: {
          checksum: { type: :string }, postable: { type: :boolean }, balanced: { type: :boolean },
          total: { type: :string },
          open_temporary: { type: :array, items: { type: :object }, description: 'Temporary balances that block the entry' },
          lines: { type: :array, items: { type: :object } }
        }
      },
      beginning: {
        type: %i[object null],
        description: 'Only at the beginning step: the ending entry mirrored into the next year',
        properties: {
          next_fiscal_year: { oneOf: [ year_schema, { type: :null } ] },
          date: { type: %i[string null], format: :date },
          postable: { type: :boolean },
          blockers: { type: :array, items: { type: :string, enum: %w[next_fiscal_year_missing next_fiscal_year_not_open
                                                                      beginning_entry_exists manual_beginning_entries
                                                                      next_year_permanent_revaluations] } },
          total: { type: :string },
          lines: { type: :array, items: { type: :object } },
          manual_beginning_entries: { type: :array, items: { type: :object } },
          permanent_revaluations: { type: :array, items: { type: :object } }
        }
      },
      summary: {
        type: %i[object null],
        description: 'Only once the year is closed',
        properties: {
          closed_at: { type: %i[string null] }, closed_by_name: { type: %i[string null] },
          closing_method: { type: %i[string null] }, net_result: { type: %i[string null] },
          next_fiscal_year_id: { type: %i[integer null] }
        }
      },
      step_error: { type: %i[string null], description: "Why the current step's preview can't be built" },
      renumber: {
        type: %i[object null],
        description: 'Only at the renumber step: entries whose number would change',
        properties: { entries_count: { type: :integer }, changed_count: { type: :integer },
                      changes: { type: :array, items: { type: :object } } }
      },
      line_templates: {
        type: :object,
        description: 'Line description templates of the closing entries: own (this closing) and defaults',
        properties: { own: { type: :object }, defaults: { type: :object } }
      },
      entries: { type: :array, items: { type: :object } }
    },
    required: %w[fiscal_year steps current_step entries]
  }

  let(:eur) { create(:accounting_currency, organization: organization, abr: 'EUR') }

  def unrevalued_foreign_balance!
    organization.accounting_setting.update!(
      default_fx_gain_account: create_account_in(organization, 'RE', ledger_code: '90'),
      default_fx_loss_account: create_account_in(organization, 'EX', ledger_code: '90')
    )
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 3, 1), lines: [
      je_line(bank, debit: 110, currency: eur, rate: 1.1), je_line(revenue, credit: 110)
    ])
    create(:accounting_exchange_rate, organization: organization, currency: eur, date: Date.new(2024, 12, 31), rate: '1.2')
  end

  path '/organizations/{organization_id}/accounting/fiscal_year_closings/{id}' do
    parameter name: :organization_id, in: :path, type: :integer, required: true
    parameter name: :id, in: :path, type: :integer, required: true, description: 'Fiscal year ID'

    get 'Closing state and readiness of a fiscal year' do
      tags 'Fiscal Year Closing'
      produces 'application/json'

      response '200', 'State' do
        schema state_schema

        before do
          grant(Permission::ACCOUNTING_CLOSE_FISCAL_YEARS)
          booked_entry!
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['current_step']).to eq('readiness')
          expect(data['readiness']).to include('ready' => false, 'blockers' => [ 'unapproved_entries' ], 'booked_count' => 1)
          expect(data['readiness']['next_fiscal_year']['id']).to eq(next_year.id)
        end
      end

      response '200', "A step whose preview can't be built" do
        schema state_schema

        before do
          grant(Permission::ACCOUNTING_CLOSE_FISCAL_YEARS)
          to_temp_closing!
          # The closing account recorded when closing started is gone.
          fiscal_year.reload.update_column(:closing_data, fiscal_year.closing_data.merge(
            'settings' => fiscal_year.closing_data['settings'].merge('retained_earnings_account_id' => 0)
          ))
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to include('current_step' => 'temp_closing', 'temp_closing' => nil)
          expect(data['step_error']).to be_present
        end
      end

      response '403', 'Needs the close permission' do
        before { grant(Permission::ACCOUNTING_APPROVE_JOURNAL_ENTRIES) }

        run_test!
      end
    end
  end

  path '/organizations/{organization_id}/accounting/fiscal_year_closings/{id}/approve_all' do
    parameter name: :organization_id, in: :path, type: :integer, required: true
    parameter name: :id, in: :path, type: :integer, required: true

    post 'Approve all booked entries of the year' do
      tags 'Fiscal Year Closing'
      produces 'application/json'

      response '200', 'Approved' do
        schema type: :object,
               properties: { approved: { type: :integer }, failed: { type: :array, items: { type: :object } } }

        before do
          grant(Permission::ACCOUNTING_CLOSE_FISCAL_YEARS, Permission::ACCOUNTING_APPROVE_JOURNAL_ENTRIES)
          booked_entry!
        end

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to include('approved' => 1, 'failed' => [])
          expect(fiscal_year.journal_entries.booked).to be_empty
        end
      end

      response '403', 'Closing permission without the approve permission' do
        before do
          grant(Permission::ACCOUNTING_CLOSE_FISCAL_YEARS)
          booked_entry!
        end

        run_test! do
          expect(fiscal_year.journal_entries.booked.count).to eq(1)
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/fiscal_year_closings/{id}/start' do
    parameter name: :organization_id, in: :path, type: :integer, required: true
    parameter name: :id, in: :path, type: :integer, required: true

    post 'Start closing (locks the year)' do
      tags 'Fiscal Year Closing'
      produces 'application/json'

      before { grant(Permission::ACCOUNTING_CLOSE_FISCAL_YEARS) }

      response '200', 'Closing started' do
        schema state_schema

        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['fiscal_year']['status']).to eq('closing')
          expect(data['current_step']).to eq('renumber')
          expect(data['readiness']).to be_nil
        end
      end

      response '422', 'Not ready' do
        before { booked_entry! }

        run_test! do |response|
          expect(JSON.parse(response.body)).to include('code' => 'not_ready')
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/fiscal_year_closings/{id}/cancel' do
    parameter name: :organization_id, in: :path, type: :integer, required: true
    parameter name: :id, in: :path, type: :integer, required: true

    post 'Cancel closing (before anything was posted)' do
      tags 'Fiscal Year Closing'
      produces 'application/json'

      response '200', 'Open again' do
        schema state_schema

        before do
          grant(Permission::ACCOUNTING_CLOSE_FISCAL_YEARS)
          start_closing!(fiscal_year, member: member)
        end

        run_test! do |response|
          expect(JSON.parse(response.body)['fiscal_year']['status']).to eq('open')
        end
      end

      response '422', 'Closing entries exist (roll back first)' do
        before do
          grant(Permission::ACCOUNTING_CLOSE_FISCAL_YEARS)
          to_temp_closing!
          Accounting::Closing::TempClosing.new(fiscal_year.reload, member: member)
                                          .post!(checksum: Accounting::Closing::TempClosing.new(fiscal_year).plan.checksum)
        end

        run_test! do |response|
          expect(JSON.parse(response.body)).to include('code' => 'roll_back_first')
          expect(fiscal_year.reload).to be_closing
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/fiscal_year_closings/{id}/renumber' do
    parameter name: :organization_id, in: :path, type: :integer, required: true
    parameter name: :id, in: :path, type: :integer, required: true

    post 'Renumber the entries of the year by date and type (optional step)' do
      tags 'Fiscal Year Closing'
      produces 'application/json'
      before do
        grant(Permission::ACCOUNTING_CLOSE_FISCAL_YEARS)
        post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 5, 1), no: '20', lines: [ je_line(bank, debit: 10), je_line(revenue, credit: 10) ])
        post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 2, 1), no: '21', lines: [ je_line(bank, debit: 10), je_line(revenue, credit: 10) ])
        Accounting::Closing::Starter.new(fiscal_year, member: member).call
      end

      response '200', 'Renumbered; now at the revaluation step' do
        schema state_schema
        run_test! do |response|
          expect(JSON.parse(response.body)['current_step']).to eq('revaluation')
          expect(fiscal_year.journal_entries.order(:date).pluck(:no)).to eq(%w[1 2])
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/fiscal_year_closings/{id}/skip_renumber' do
    parameter name: :organization_id, in: :path, type: :integer, required: true
    parameter name: :id, in: :path, type: :integer, required: true

    post 'Keep the current numbers' do
      tags 'Fiscal Year Closing'
      produces 'application/json'
      before do
        grant(Permission::ACCOUNTING_CLOSE_FISCAL_YEARS)
        Accounting::Closing::Starter.new(fiscal_year, member: member).call
      end

      response '200', 'Now at the revaluation step' do
        schema state_schema
        run_test! do |response|
          expect(JSON.parse(response.body)['current_step']).to eq('revaluation')
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/fiscal_year_closings/{id}/line_templates' do
    parameter name: :organization_id, in: :path, type: :integer, required: true
    parameter name: :id, in: :path, type: :integer, required: true
    parameter name: :body, in: :body, schema: {
      type: :object,
      properties: {
        kind: { type: :string, enum: %w[closing closing_offset ending beginning] },
        template: { type: :object, description: '{ locale => template }; blank locales use the default' }
      },
      required: %w[kind template]
    }

    patch 'Set a line description template of the closing entries' do
      tags 'Fiscal Year Closing'
      consumes 'application/json'
      produces 'application/json'
      before do
        grant(Permission::ACCOUNTING_CLOSE_FISCAL_YEARS)
        start_closing!(fiscal_year, member: member)
      end

      response '200', 'Saved' do
        schema state_schema
        let(:body) { { kind: 'ending', template: { en: 'End {account_name}' } } }
        run_test! do |response|
          templates = JSON.parse(response.body)['line_templates']
          expect(templates['own']).to eq('ending' => { 'en' => 'End {account_name}' })
          expect(templates['defaults']['ending']['en']).to start_with('Ending balance of')
        end
      end

      response '422', 'Unknown variable' do
        let(:body) { { kind: 'ending', template: { en: 'End {rate}' } } }
        run_test! do |response|
          expect(JSON.parse(response.body)['errors'].join).to include('{rate}')
        end
      end

      response '422', 'Unknown kind' do
        let(:body) { { kind: 'sometimes', template: { en: 'End' } } }
        run_test! do |response|
          expect(JSON.parse(response.body)).to include('code' => 'invalid_line_template_kind')
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/fiscal_year_closings/{id}/acknowledge_revaluation' do
    parameter name: :organization_id, in: :path, type: :integer, required: true
    parameter name: :id, in: :path, type: :integer, required: true

    post 'Acknowledge remaining revaluation differences and missing rates' do
      tags 'Fiscal Year Closing'
      produces 'application/json'
      before do
        grant(Permission::ACCOUNTING_CLOSE_FISCAL_YEARS)
        unrevalued_foreign_balance!
      end

      response '200', 'Acknowledged' do
        schema state_schema
        before { start_closing!(fiscal_year, member: member) }
        run_test! do |response|
          check = JSON.parse(response.body)['revaluation_check']
          expect(check).to include('acknowledged' => true, 'passes' => true, 'clean' => false, 'total_difference' => '10.0')
          expect(check['unrevalued'].first).to include('account_id' => bank.id, 'difference' => '10.0')
        end
      end

      response '422', 'Not at the revaluation step' do
        run_test! do |response|
          expect(JSON.parse(response.body)).to include('code' => 'wrong_step')
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/fiscal_year_closings/{id}/complete_revaluation' do
    parameter name: :organization_id, in: :path, type: :integer, required: true
    parameter name: :id, in: :path, type: :integer, required: true

    post 'Finish the revaluation step' do
      tags 'Fiscal Year Closing'
      produces 'application/json'
      before do
        grant(Permission::ACCOUNTING_CLOSE_FISCAL_YEARS)
        unrevalued_foreign_balance!
        start_closing!(fiscal_year, member: member)
      end

      response '200', 'Moved to closing temporary accounts' do
        schema state_schema
        before { Accounting::Closing::RevaluationStep.new(fiscal_year, member: member).acknowledge! }
        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['current_step']).to eq('temp_closing')
          expect(data['revaluation_check']).to be_nil
        end
      end

      response '422', 'Differences remain' do
        run_test! do |response|
          expect(JSON.parse(response.body)).to include('code' => 'revaluation_incomplete')
        end
      end

      response '403', 'Needs the close permission' do
        before { Permission.where(grantee: member).delete_all }
        run_test!
      end
    end
  end

  def to_temp_closing!
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 3, 1),
               lines: [ je_line(bank, debit: 10), je_line(revenue, credit: 10) ])
    start_closing!(fiscal_year, member: member)
    Accounting::Closing::RevaluationStep.new(fiscal_year.reload, member: member).complete!
  end

  path '/organizations/{organization_id}/accounting/fiscal_year_closings/{id}/post_temp_closing' do
    parameter name: :organization_id, in: :path, type: :integer, required: true
    parameter name: :id, in: :path, type: :integer, required: true
    parameter name: :body, in: :body, schema: {
      type: :object, properties: { checksum: { type: :string, description: 'temp_closing.checksum of the reviewed preview' } },
      required: %w[checksum]
    }

    post 'Post the entries closing the temporary accounts' do
      tags 'Fiscal Year Closing'
      consumes 'application/json'
      produces 'application/json'
      before do
        grant(Permission::ACCOUNTING_CLOSE_FISCAL_YEARS)
        to_temp_closing!
      end

      response '200', 'Posted; now at the ending step' do
        schema state_schema
        let(:body) { { checksum: Accounting::Closing::TempClosing.new(fiscal_year.reload).plan.checksum } }
        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['current_step']).to eq('ending')
          expect(data['entries'].map { |e| e['entry_type'] }).to eq(%w[closing_temp_accounts])
        end
      end

      response '409', 'The preview is outdated' do
        let(:body) { { checksum: 'outdated' } }
        run_test! do |response|
          expect(JSON.parse(response.body)).to include('code' => 'stale')
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/fiscal_year_closings/{id}/post_ending' do
    parameter name: :organization_id, in: :path, type: :integer, required: true
    parameter name: :id, in: :path, type: :integer, required: true
    parameter name: :body, in: :body, schema: {
      type: :object, properties: { checksum: { type: :string, description: 'ending.checksum of the reviewed preview' } },
      required: %w[checksum]
    }

    post 'Post the ending entry' do
      tags 'Fiscal Year Closing'
      consumes 'application/json'
      produces 'application/json'
      before do
        grant(Permission::ACCOUNTING_CLOSE_FISCAL_YEARS)
        to_temp_closing!
        service = Accounting::Closing::TempClosing.new(fiscal_year.reload, member: member)
        service.post!(checksum: service.plan.checksum)
      end

      response '200', 'Posted; now at the beginning step' do
        schema state_schema
        let(:body) { { checksum: Accounting::Closing::EndingEntry.new(fiscal_year.reload).plan.checksum } }
        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['current_step']).to eq('beginning')
          expect(data['entries'].map { |e| e['entry_type'] }).to eq(%w[closing_temp_accounts ending])
        end
      end

      response '409', 'The preview is outdated' do
        let(:body) { { checksum: 'outdated' } }
        run_test!
      end
    end
  end

  path '/organizations/{organization_id}/accounting/fiscal_year_closings/{id}/post_beginning' do
    parameter name: :organization_id, in: :path, type: :integer, required: true
    parameter name: :id, in: :path, type: :integer, required: true

    post 'Post the beginning entry of the next year and close the year' do
      tags 'Fiscal Year Closing'
      produces 'application/json'
      before do
        grant(Permission::ACCOUNTING_CLOSE_FISCAL_YEARS)
        to_temp_closing!
        temp = Accounting::Closing::TempClosing.new(fiscal_year.reload, member: member)
        temp.post!(checksum: temp.plan.checksum)
        ending = Accounting::Closing::EndingEntry.new(fiscal_year.reload, member: member)
        ending.post!(checksum: ending.plan.checksum)
      end

      response '200', 'Closed' do
        schema state_schema
        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['fiscal_year']['status']).to eq('closed')
          expect(data['current_step']).to eq('finalized')
          expect(data['summary']).to include('net_result' => '10.0')
          expect(data['entries'].map { |e| e['entry_type'] }).to eq(%w[closing_temp_accounts ending beginning])
        end
      end

      response '422', 'Blocked' do
        before { next_year.update_column(:status, FiscalYear.statuses[:closing]) }
        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data).to include('code' => 'beginning_blocked')
          expect(data['details']['blockers']).to eq([ 'next_fiscal_year_not_open' ])
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/fiscal_year_closings/{id}/reopen_fully' do
    parameter name: :organization_id, in: :path, type: :integer, required: true
    parameter name: :id, in: :path, type: :integer, required: true

    post 'Undo the whole closing (also of a closed year)' do
      tags 'Fiscal Year Closing'
      produces 'application/json'
      before do
        grant(Permission::ACCOUNTING_CLOSE_FISCAL_YEARS)
        to_temp_closing!
        temp = Accounting::Closing::TempClosing.new(fiscal_year.reload, member: member)
        temp.post!(checksum: temp.plan.checksum)
        ending = Accounting::Closing::EndingEntry.new(fiscal_year.reload, member: member)
        ending.post!(checksum: ending.plan.checksum)
        Accounting::Closing::BeginningEntry.new(fiscal_year.reload, member: member).post!
      end

      response '200', 'Open again' do
        schema state_schema
        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['fiscal_year']['status']).to eq('open')
          expect(data['entries']).to eq([])
        end
      end

      response '422', 'The next year is not open' do
        before { next_year.update_column(:status, FiscalYear.statuses[:closing]) }
        run_test! do |response|
          expect(JSON.parse(response.body)).to include('code' => 'reopen_blocked')
        end
      end
    end
  end

  path '/organizations/{organization_id}/accounting/fiscal_year_closings/{id}/rollback' do
    parameter name: :organization_id, in: :path, type: :integer, required: true
    parameter name: :id, in: :path, type: :integer, required: true

    post 'Go back one step, undoing what the previous step posted' do
      tags 'Fiscal Year Closing'
      produces 'application/json'
      before { grant(Permission::ACCOUNTING_CLOSE_FISCAL_YEARS) }

      response '200', 'Back at the previous step' do
        schema state_schema
        before do
          to_temp_closing!
          service = Accounting::Closing::TempClosing.new(fiscal_year.reload, member: member)
          service.post!(checksum: service.plan.checksum)
        end
        run_test! do |response|
          data = JSON.parse(response.body)
          expect(data['current_step']).to eq('temp_closing')
          expect(data['entries']).to eq([])
          expect(data['temp_closing']['entries'].size).to eq(1)
        end
      end

      response '422', 'Not closing' do
        run_test! do |response|
          expect(JSON.parse(response.body)).to include('code' => 'not_closing')
        end
      end
    end
  end
end
