require "rails_helper"

RSpec.describe "Accounting::JournalEntryItems print views", type: :request do
  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let(:member) { create(:member, organization: organization, user: user) }
  let(:fiscal_year) do
    create(:fiscal_year, organization: organization, start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31))
  end
  let(:category) { organization.account_categories.find_by!(identifier: "CA") }
  let(:ledger) { create(:accounting_ledger, account_category: category, code: "10") }
  let(:bank) { create(:accounting_account, ledger: ledger, code: "01", name: { en: "Bank" }) }
  let(:cash) { create(:accounting_account, ledger: ledger, code: "02", name: { en: "Cash" }) }
  let(:base_path) { "/organizations/#{organization.id}/accounting/journal_entry_items" }
  let(:scope_params) { { from: "2024-01-01", to: "2024-12-31" } }

  before do
    sign_in(user)
    create(:permission, code: Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES, grantee: member, organization: organization)
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 3, 1), state: :booked,
               lines: [ je_line(bank, debit: 5000), je_line(cash, credit: 5000) ])
    post_entry(fiscal_year: fiscal_year, date: Date.new(2024, 4, 1), state: :booked,
               lines: [ je_line(cash, debit: 1200), je_line(bank, credit: 1200) ])
  end

  def filters(dimension, ids)
    [ { dimension: dimension, ids: ids } ].to_json
  end

  describe "explorer (group_by)" do
    it "returns the grouped rows with totals and a description of what was printed" do
      get "#{base_path}/group_by", params: scope_params.merge(view: "print", group_by: "account",
                                                             filters: filters("ledger", [ ledger.id ])), as: :json

      expect(response).to have_http_status(:ok)
      data = response.parsed_body
      expect(data).to include(
        "organization_name" => organization.name, "from" => "2024-01-01", "to" => "2024-12-31",
        "group_by" => "account", "group_by_name" => "Account",
        "entry_types_text" => "Normal, Beginning, Revaluation", "states_text" => "Booked and approved",
        "total_debit" => 6200.0, "total_credit" => 6200.0,
        "total_debit_balance" => 3800.0, "total_credit_balance" => 3800.0
      )
      expect(data["filters"]).to eq([ { "dimension" => "ledger", "dimension_name" => "Ledger",
                                        "items_text" => "#{ledger.full_code} #{ledger.name}" } ])
      expect(data["rows"].map { |row| row["code"] }).to eq([ bank.full_code, cash.full_code ])
      expect(data["rows"].first).to include("sum_debit" => 5000.0, "sum_credit" => 1200.0, "debit_balance" => 3800.0)
      expect(data["currency"]).to include("abr" => organization.accounting_setting.main_currency.abr)
    end

    it "uses the locale of the printed template" do
      bank.update_columns(name: { "en" => "Bank", "fa" => "بانک" })

      get "#{base_path}/group_by", params: scope_params.merge(view: "print", group_by: "account", locale: "fa"), as: :json

      data = response.parsed_body
      expect(data["group_by_name"]).to eq("حساب")
      expect(data["entry_types_text"]).to eq("عادی، افتتاحیه، تسعیر")
      expect(data["rows"].map { |row| row["name"] }).to include("بانک")
    end
  end

  describe "journal entry items (index)" do
    it "returns the items with their entries, accounts and totals" do
      get base_path, params: scope_params.merge(view: "print", filters: filters("account", [ bank.id ])), as: :json

      expect(response).to have_http_status(:ok)
      data = response.parsed_body
      expect(data).to include("total_debit" => 5000.0, "total_credit" => 1200.0)
      expect(data["filters"].first).to include("dimension_name" => "Account", "items_text" => "#{bank.full_code} Bank")
      expect(data["items"].size).to eq(2)
      expect(data["items"].map { |item| item["date"] }).to contain_exactly("2024-03-01", "2024-04-01")
      expect(data["items"].first).to include("account_code" => bank.full_code, "account_name" => "Bank",
                                             "currency" => organization.accounting_setting.main_currency.abr)
    end

    it "keeps the list view without view=print" do
      get base_path, params: scope_params, as: :json

      expect(response.parsed_body).to be_an(Array)
    end

    it "rejects unknown views" do
      get base_path, params: scope_params.merge(view: "other"), as: :json

      expect(response).to have_http_status(:bad_request)
    end

    it "is forbidden without permission to view journal entries" do
      Permission.where(grantee: member).delete_all

      get base_path, params: scope_params.merge(view: "print"), as: :json

      expect(response).to have_http_status(:forbidden)
    end
  end
end
