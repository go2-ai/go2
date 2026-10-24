namespace :reporting do
  # Times the reporting runs on a generated organization (default 2,000
  # accounts in 40 ledgers and 100,000 journal entry items over one year),
  # inside a transaction that is rolled back, so nothing is kept.
  #
  #   bin/rails reporting:benchmark ACCOUNTS=2000 ITEMS=100000 CENTERS=500
  desc "Benchmark financial statements, trial balance, inspection and ratios"
  task benchmark: :environment do
    require "benchmark"

    accounts_count = Integer(ENV.fetch("ACCOUNTS", 2000))
    items_count = Integer(ENV.fetch("ITEMS", 100_000))
    centers_count = Integer(ENV.fetch("CENTERS", 500))
    lines_per_entry = 4

    ActiveRecord::Base.transaction do
      Accounting::Statements::Presets::Loader.call
      organization = Organization.create!(name: { "en" => "Reporting benchmark" })
      year = organization.fiscal_years.order(:start_date).first

      puts "Building #{accounts_count} accounts, #{centers_count} centers, #{items_count} items..."
      setup = Benchmark.realtime do
        categories = organization.account_categories.where(identifier: %w[CA LA CL LL OE RE EX]).to_a
        ledgers_count = (accounts_count / 50.0).ceil
        ledgers = Array.new(ledgers_count) do |index|
          category = categories[index % categories.size]
          Accounting::Ledger.create!(account_category: category, code: format("%02d", 10 + (index / categories.size)),
                                     name: { "en" => "Ledger #{index}" }, unexpected_balance: :accept)
        end
        now = Time.current
        account_rows = Array.new(accounts_count) do |index|
          { ledger_id: ledgers[index % ledgers_count].id, code: format("%02d", 10 + (index / ledgers_count)),
            name: { "en" => "Account #{index}" }, accepts_other_currencies: false, created_at: now, updated_at: now }
        end
        Accounting::Account.insert_all!(account_rows)
        account_ids = Accounting::Account.where(ledger_id: ledgers.map(&:id)).pluck(:id)

        center_type_id = Accounting::CenterType.insert_all!([ { organization_id: organization.id, name: { "en" => "Customers" },
                                                                first_code: "000001", last_code: "999999",
                                                                created_at: now, updated_at: now } ],
                                                             returning: [ :id ]).rows.first.first
        center_type = Accounting::CenterType.find(center_type_id)
        Accounting::Center.insert_all!(Array.new(centers_count) do |index|
          { center_type_id: center_type.id, code: format("%06d", index + 1), name: { "en" => "Customer #{index}" },
            created_at: now, updated_at: now }
        end)
        center_ids = center_type.centers.pluck(:id)

        currency_id = organization.accounting_setting.main_currency_id
        entries_count = items_count / lines_per_entry
        days = (year.finish_date - year.start_date).to_i
        entry_rows = Array.new(entries_count) do |index|
          date = year.start_date + (index % days)
          { date: date, effective_date: date, fiscal_year_id: year.id, no: (index + 1).to_s, ref: (index + 1).to_s,
            daily_no: index + 1, state: Accounting::JournalEntry.states[:approved], entry_type: Accounting::JournalEntry.entry_types[:normal],
            organization_id: organization.id, debit: 200, credit: 200, created_at: now, updated_at: now }
        end
        entry_ids = entry_rows.each_slice(5_000).flat_map { |slice| Accounting::JournalEntry.insert_all!(slice, returning: [ :id ]).rows.flatten }

        random = Random.new(42)
        entry_ids.each_slice(2_000) do |slice|
          rows = slice.flat_map do |entry_id|
            Array.new(lines_per_entry) do |line|
              debit = line.even? ? 100 : 0
              { journal_entry_id: entry_id, row: line + 1, account_id: account_ids[random.rand(account_ids.size)],
                center1_id: center_ids[random.rand(center_ids.size)], debit: debit, credit: 100 - debit,
                currency_id: currency_id, created_at: now, updated_at: now }
            end
          end
          Accounting::JournalEntryItem.insert_all!(rows)
        end
      end
      puts format("  setup: %.1fs", setup)

      bs = Reporting::Reports::Copy.call(source: Reporting::Report.system.find_by!(key: "ifrs.balance_sheet"), organization: organization)
      pl = Reporting::Reports::Copy.call(source: Reporting::Report.system.find_by!(key: "ifrs.income_statement"), organization: organization)
      # A per-customer sign split on every current asset ledger, the expensive case.
      bs.statement_layout.rules.create!(line: bs.statement_layout.lines.find_by!(key: "trade_and_other_receivables"),
                                        opposite_line: bs.statement_layout.lines.find_by!(key: "contract_liabilities"),
                                        selector_type: :category, selector: { "identifiers" => [ "CA" ] }, grain: "account_center1",
                                        priority: 1)
      # An administrator's view: every report is accessible.
      admin = Class.new { def is_go3_admin? = true; def member(_organization) = nil }.new
      access = Reporting::Access.new(admin, organization)
      params = ActionController::Parameters.new(date: year.finish_date.iso8601, from: year.start_date.iso8601, to: year.finish_date.iso8601)
      tb = Reporting::Report.system.find_by!(key: "general.trial_balance")
      ratios = Reporting::Report.system.find_by!(key: "general.financial_ratios")

      if ENV["PROFILE"]
        scope = Accounting::Explorer::EntryScope.new(organization: organization, from: year.start_date, to: year.finish_date)
        query = nil
        puts format("  [profile] balances query       %.2fs", Benchmark.realtime { query = Accounting::Balances::Query.new(organization: organization, entry_scope: scope).call })
        q = Accounting::Balances::Query.new(organization: organization, entry_scope: scope)
        cols = Accounting::Balances::Query::GROUP_COLUMNS.map { |c| Arel.sql(c) }
        puts format("  [profile] balances SQL only    %.2fs", Benchmark.realtime { ActiveRecord::Base.connection.select_rows(q.relation.group(*cols).select(*cols, Arel.sql("SUM(journal_entry_items.debit)"), Arel.sql("SUM(journal_entry_items.credit)")).to_sql) })
        rows = nil
        puts format("  [profile] row source            %.2fs", Benchmark.realtime { rows = Accounting::Statements::RowSource.new(organization: organization).rows(scope) })
        puts format("  [profile] engine                %.2fs", Benchmark.realtime { Accounting::Statements::Engine.from_layout(bs.statement_layout, rows: rows).call })
        columns = Accounting::Statements::ReportType.columns(bs, organization, params)
        runner = Accounting::Statements::Runner.new(report: bs, organization: organization, columns: columns)
        puts format("  [profile] runner (%d columns)    %.2fs", columns.size, Benchmark.realtime { runner.call })
        result = runner.call
        puts format("  [profile] payload               %.2fs", Benchmark.realtime { Accounting::Statements::Payload.new(result, organization: organization).run })
      end

      {
        "balance sheet (2 columns)" => -> { Accounting::Statements::ReportType.run(bs, organization: organization, params: params) },
        "profit or loss (2 columns)" => -> { Accounting::Statements::ReportType.run(pl, organization: organization, params: params) },
        "drill: line → accounts" => lambda {
          Accounting::Statements::ReportType.drill(bs, organization: organization, params: params.merge(line: "trade_and_other_receivables"))
        },
        "inspection list" => lambda {
          columns = Accounting::Statements::ReportType.columns(bs, organization, params.merge(comparison: false))
          Accounting::Statements::Inspection.new(report: bs, organization: organization, column: columns.first).call
        },
        "trial balance (accounts × centers)" => lambda {
          Accounting::TrialBalance::ReportType.run(tb, organization: organization, params: params.merge(level: "account", center_level: 1))
        },
        "financial ratios (2 columns)" => lambda {
          Accounting::Ratios::ReportType.run(ratios, organization: organization, params: params, access: access)
        }
      }.each do |name, run|
        result = nil
        seconds = Benchmark.realtime { result = run.call }
        rows = result.is_a?(Hash) ? (result[:rows] || result[:lines] || result[:ratios]).to_a.size : 0
        puts format("  %-36s %6.2fs  (%d rows)", name, seconds, rows)
      end

      raise ActiveRecord::Rollback
    end
  end
end
