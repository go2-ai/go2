# Reporting

Financial statements, trial balance and financial ratios, with per-report access, a rule-based mapping from
accounts to statement lines, an inspection list to audit that mapping, an AI mapping assistant, and
PDF/Excel output. Phase 1 of the reporting plan; scheduling, delivery, server rendering, dashboards and notes
are later phases.

## Where the code lives

| Part | Location |
|---|---|
| Report platform (domain-independent): catalog, grants, access, report types, Report Center API | `app/systems/reporting/` |
| Statement layouts, lines, mapping rules, engine, runner, inspection | `app/systems/accounting/{models,services/statements}` |
| Trial balance | `app/systems/accounting/services/trial_balance` |
| Ratios (catalog in `services/ratios/catalog.yml`) | `app/systems/accounting/services/ratios` |
| AI mapping assistant | `app/systems/accounting/services/statement_mapping_ai`, `controllers/statement_mapping_ai` |
| Presets (system reports) | `app/systems/accounting/presets/**/*.yml`, loaded by `db/seeds/reports.rb` |
| Print templates (Ariana) | `app/systems/accounting/services/reports/{financial_statement,trial_balance,financial_ratios}_template.rb` |
| Frontend: Report Center, viewer page, access dialog, export bar | `frontend/src/features/reporting` |
| Frontend: statement viewer, layout editor, inspection, AI panel, trial balance, ratios | `frontend/src/features/accounting/{statements,trialBalance,ratios}` |
| API description | `swagger/v1/reporting.yaml` (served at `/api-docs`) |

Tables: `reports`, `report_grants`, `statement_layouts`, `statement_lines`, `statement_mapping_rules`.

## Report types

A report's `report_type` names a handler registered in `config/initializers/reporting.rb`:

```ruby
Reporting::ReportTypes.register("accounting.statement", "Accounting::Statements::ReportType")
```

A handler is a module with:

| Method | Purpose |
|---|---|
| `run(report, organization:, params:, access:)` | JSON for the viewer (`GET reports/:id/run`) |
| `drill(report, organization:, params:, access:)` | Breakdown of one figure (`GET reports/:id/drill`) |
| `print(report, organization:, params:, access:)` | Data of the print template (`run?view=print&locale=`) |
| `copy_content(source, copy)` | Copies what the report computes when a report is copied |
A future system (e.g. payroll) adds its own types and presets the same way and gets the catalog, grants,
Report Center and printing without changes to `reporting`. On the frontend, add its viewer to `VIEWERS` in
`features/reporting/ReportViewerPage.tsx` and its print key to `PRINT_KEYS` in `reportingApi.ts`.

## System reports and copies

Presets are system reports (`organization_id` NULL, a `key` such as `ifrs.balance_sheet`), rebuilt from YAML
on every seed run. They are read-only; organizations run them directly or copy them
(`POST reports/:id/copy`). A copy keeps `parent_report_id`. The first copy of a statement type becomes the
organization's *primary* report of that type; ratios read the primary statements (or the IFRS presets when
there are none).

Shipped presets: IFRS statement of financial position, profit or loss (IFRS 18 subtotals and categories in
line metadata), cash flows (indirect), trial balance, financial ratios.

### Adding a preset

Create a YAML file under `app/systems/accounting/presets/` (see `ifrs/balance_sheet.yml` for the format: `key`,
`standard`, `statement_type`, `category`, `name`/`description` per locale, `settings`, nested `lines`, `rules`),
then run `bin/rails db:seed` (or `Accounting::Statements::Presets::Loader.call`). Lines default to kind
`mapped` and to their parent's normal side. Give presets catch-all category rules so a new organization's
statement balances immediately.

## Statements

### Lines

`heading` (caption only), `mapped` (balances its rules map to it, plus its children) or `formula` (Dentaku
over line keys, e.g. `revenue + cost_of_sales`). Each line has a normal side; its value is the balance on
that side, so with credit-normal profit or loss lines expenses are negative and formulas simply add lines.
Children on the other side are subtracted (contra lines). Keys can't change after creation (formulas and
ratios use them); a line used by formulas can't be deleted. Styles: `bold`, `underline`, `hide_if_zero`,
`hidden` (helper lines).

### Mapping rules

A rule selects balances and sends them to a line:

| selector_type | selector |
|---|---|
| `category` | `identifiers` (CA LA CL LL OE RE EX CO ME) or `ids` |
| `ledger` | `ids` |
| `account` | `ids`, or `settings` (accounts named in the accounting settings, e.g. the retained earnings account) |
| `account_range` | `from`/`to`: prefixes of the account's full code, same length |
| `profit_or_loss` | `period`: `current` (the fiscal year of the date) or `prior` |

Optional filters: `center_level` with `center_ids`/`center_type_ids`, and `currency_ids`.

**Precedence.** Among the rules matching a balance, the highest `priority` wins (blank = 0); with equal
priorities the most specific: account > account range > ledger > category, and a center or currency filter
makes a rule more specific. Rules equal on both that can match the same balances are rejected when saved, and
any remaining overlap is reported by the run (`rule_conflict`).

**Sign split.** With `opposite_line`, balances on the side opposite to the line's normal side go to that
line, judged per `grain`: `account_center1` judges each customer separately (gross, as IFRS requires),
`account` nets the account. Example: receivables per customer, customers in credit to contract liabilities.

**Measures.** `balance` (default); `change`, `debit_movement`, `credit_movement` for cash flow lines.

### Periods

* Balance sheet columns are *as of* a date. They accumulate every entry from the first fiscal year's start,
  leaving out year-end entries (temporary closing, ending) and later years' beginning entries, so the result
  is the same whether or not years are closed. Income statement balances before the date's fiscal year are
  `prior` (retained earnings), those within it `current` (profit for the year).
* Income statement and cash flow columns cover a period. The comparison column is the same dates one year
  earlier, when within the fiscal years.
* `approved_only` limits to approved entries; otherwise booked and approved. Drafts are never included.

### Checks (shown above the figures)

`unmapped` (balances no rule maps), `rule_conflict`, `line_cycle` / `line_formula` / `line_unknown_line`,
`not_balanced` (layout `checks`, e.g. total assets = total equity and liabilities), `other_balances` (control
and memorandum accounts), `draft_entries`, `unapproved_entries`, `fiscal_year_open`, and for cash flows
`cash_not_mapped`.

### Cash flow statement (indirect)

All lines are credit-normal (inflows positive). Flows are the period's `normal` entries: opening entries
aren't flows and revaluations aren't cash. The cash ledgers must be mapped to the hidden `cash_movement`
line; cash at the beginning and end and the effect of exchange rate changes (revaluations of cash) are
computed from the balances mapped there. The statement checks that
`cash_at_end = cash_at_beginning + net_increase_in_cash + effect_of_exchange_rate_changes`.

### Drill-down and inspection

* Viewer: line → its accounts → the centers of one level → the journal entry items page (only for members
  who may read journal entries).
* Inspection list (`GET accounting/statements/:id/inspection`): every balance of a column (account × centers
  × currency) with Category, Ledger, Account, Center 1..N, Currency, Balance, *Reflected in*, the winning
  rule, the overridden rules, the reclassified flag and the group total that decided the side. It shows the
  whole ledger, so it needs edit access to the report or journal entry viewing permission. With
  `proposed_rules` it adds *Reflected in (proposed)* and marks rows that move.

## Trial balance

Opening, period and closing debits and credits at category, ledger or account level, optionally split by the
centers of one level. Balance sheet accounts open with everything before the period; income statement
accounts open with the period's fiscal year so far, and earlier years' results appear on a separate
"prior years' result" row, so the trial balance is the same closed or not. Totals of each pair are checked.

## Financial ratios

16 ratios in `services/ratios/catalog.yml` (liquidity, leverage, profitability, efficiency). Formula
variables: `bs.<line>` (end of period), `bs_open.<line>` (day before the period; the closing balance when the
period starts with the books), `pl.<line>` (period), `days`. A ratio is `n/a` with a reason when the user
can't see one of its statements, a line is missing or it divides by zero. Clicking a ratio shows its
components, which open the statements.

## Access

Per report, no row-level restrictions (`Reporting::Access`):

| Who | May |
|---|---|
| GO3 admins | everything |
| Journal entry viewers (`Accounting.view/manage/approve_journal_entries`) | view every report, drill to journal entry items |
| `Reports.manage_statements` | view every report, copy, edit organization reports (lines, rules), use the AI assistant |
| `Reports.manage_access` (or organization admin) | grant reports to members, roles, groups, departments |
| A `view` grant (directly or via role, group, department) | run, drill (to accounts and centers), print that report |
| An `edit` grant on an organization report | also change it |

Rules: drill-down stays inside the report's accounts unless the member may read journal entries; a ratio
needs access to every statement it reads; the inspection list and the AI assistant need more than a view
grant because they show the whole ledger. Print templates of reporting reports are visible to every member;
the print data endpoint enforces the report's access.

## AI mapping assistant

A chat per member and report (`AiChat` kind `statement_mapping`, subject = the report), on the layout editor's
*AI assistant* tab. The model reads the chart with read-only lookup tools (`list_ledgers`,
`accounts_in_ledger`, `balance_signs`, `unmapped_balances`, run by RubyLLM in `Ai::Adapters::RubyLlmAdapter`)
and answers with `propose_mapping_rules`: add/update/remove changes naming ledgers and accounts by full code,
each with a reason and confidence. Proposals are validated (unknown codes, lines, invalid rules) and sent
back to the model up to three times. The user picks changes, previews the inspection list with them, and
applies the picked ones in one transaction. The AI never computes figures.

Configuration: `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, or per feature `AI_PROVIDER__STATEMENT_MAPPING`,
`AI_MODEL__STATEMENT_MAPPING`. The model must support tool calling.

## Printing and export

Print/PDF through the existing Ariana report pipeline: report keys `financial_statement`, `trial_balance`,
`financial_ratios`, with generated system templates (per-organization amount decimals, mirrored for fa) that
organizations can copy and redesign in the report designer. The viewers' *Excel* button exports the figures on
screen as one data sheet. Rendering is in the browser; server rendering (Node CLI) comes with scheduling.

## Performance

`bin/rails reporting:benchmark` builds an organization in a rolled-back transaction (defaults: 2,000 accounts,
500 centers, 100,000 items over one year, a per-customer sign split) and times each run; `PROFILE=1` adds a
breakdown. On a development laptop (PostgreSQL 16, WSL):

| Run | Time |
|---|---|
| Balance sheet | ~2.9 s |
| Profit or loss | ~2.2 s |
| Drill line → accounts | ~2.8 s |
| Inspection list (93k balance rows) | ~6.2 s |
| Trial balance, accounts × centers | ~4.8 s |
| Financial ratios (3 statement runs per column) | ~5.3 s |

About half of a statement run is the balances query (SQL ~0.6 s) and building rows; the rest is the engine.
Each run reads the ledger again; if this becomes too slow for larger books, the next step is caching balance
rows per scope (keyed by the latest journal entry change) shared by the statements, ratios and drills of one
request, and summing at account grain when no rule needs centers.

## Known limits

* One mapping per layout; dimension-driven columns are supported by the engine (`Runner::Column#filters`) but
  not offered in the UI yet (needed later for GASB, not-for-profit and center columns).
* No statement of changes in equity, notes, consolidation, budgets or saved run snapshots yet.
* Ariana has no links, so PDFs aren't drillable; drill-down is on screen.
* Lines are reordered with up/down buttons (no drag and drop yet).
