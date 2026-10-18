require "rails_helper"

RSpec.describe "Accounting::JournalEntries print view", type: :request do
  let(:organization) { create(:organization) }
  let(:user) { create(:user) }
  let(:member) { create(:member, organization: organization, user: user) }
  let(:account_category) { organization.account_categories.find_by!(identifier: "CA") }
  let(:ledger) { create(:accounting_ledger, account_category: account_category, code: "10") }
  let(:account) { create(:accounting_account, ledger: ledger, code: "01", name: { en: "Cash" }) }
  let(:fiscal_year) do
    create(:fiscal_year, organization: organization, start_date: Date.new(2024, 1, 1), finish_date: Date.new(2024, 12, 31))
  end
  let(:journal_entry) do
    je = create(:accounting_journal_entry, organization: organization, fiscal_year: fiscal_year, date: Date.new(2024, 3, 1))
    je.items.create!(row: 1, account: account, debit: 100, credit: 0)
    je.items.create!(row: 2, account: account, debit: 0, credit: 100)
    je
  end
  let(:path) { "/organizations/#{organization.id}/accounting/journal_entries/#{journal_entry.id}" }

  before do
    sign_in(user)
    create(:permission, code: Permission::ACCOUNTING_VIEW_JOURNAL_ENTRIES, grantee: member, organization: organization)
  end

  it "returns the print data, including the main currency, for an entry without a creator" do
    get path, params: { view: "print" }, as: :json

    expect(response).to have_http_status(:ok)
    data = response.parsed_body
    main_currency = organization.accounting_setting.main_currency
    expect(data["creator"]).to be_nil
    expect(data["date"]).to eq("2024-03-01")
    expect(data["currency"]).to include("abr" => main_currency.abr, "decimal_digits" => main_currency.decimal_digits)
    expect(data["items"].map { |item| item["row"] }).to eq([ 1, 2 ])
  end

  it "rejects views that are not whitelisted" do
    get path, params: { view: "explorer" }, as: :json

    expect(response).to have_http_status(:bad_request)
  end
end
