export type ReportCategory = 'financial_statements' | 'general_ledger' | 'analysis';

export interface ReportPermissions {
  can_view: boolean;
  can_edit: boolean;
  can_copy: boolean;
  /** Make primary, archive and delete. */
  can_manage: boolean;
  can_manage_access: boolean;
  /** May open the journal entry items behind the figures. */
  can_drill_to_entries: boolean;
}

export interface ReportSummary {
  id: number;
  report_type: 'accounting.statement' | 'accounting.trial_balance' | 'accounting.ratios' | string;
  key: string | null;
  category: ReportCategory;
  standard: string | null;
  statement_type: 'balance_sheet' | 'income_statement' | 'cash_flow' | null;
  /** In the current language. */
  name: string;
  description: string | null;
  names: Record<string, string>;
  descriptions: Record<string, string>;
  primary: boolean;
  system: boolean;
  parent_report_id: number | null;
  organization_id: number | null;
  archived_at: string | null;
  updated_at: string;
  permissions: ReportPermissions;
}

/** The journal entries behind a column's figures (as the explorer selects them). */
export interface EntrySelection {
  from: string;
  to: string;
  entry_types: string[];
}

export interface RunColumn {
  key: 'current' | 'previous' | string;
  as_of?: string;
  from?: string;
  to?: string;
  entries: EntrySelection;
  /** Balance sheet columns: income statement balances before / within the date's fiscal year. */
  entries_prior?: EntrySelection;
  entries_current?: EntrySelection;
}

export interface LineStyle {
  bold?: boolean;
  underline?: boolean;
  hide_if_zero?: boolean;
  /** Helper lines (e.g. cash movements of a cash flow statement) not shown. */
  hidden?: boolean;
}

export interface StatementLineResult {
  key: string;
  parent_key: string | null;
  depth: number;
  kind: 'heading' | 'mapped' | 'formula';
  normal_side: 'debit' | 'credit';
  label: string;
  formula: string | null;
  style: LineStyle;
  metadata: Record<string, unknown>;
  has_contributions: boolean;
  /** Column key => decimal string on the line's normal side (null for headings). */
  values: Record<string, string | null>;
}

export interface RunCheck {
  severity: 'error' | 'warning' | 'info';
  code: string;
  column: string;
  details: Record<string, unknown>;
}

export interface RunCurrency {
  abr: string | null;
  decimal_digits: number;
}

export interface StatementRun {
  report: ReportSummary;
  columns: RunColumn[];
  lines: StatementLineResult[];
  checks: RunCheck[];
  currency: RunCurrency;
  /** Center levels the organization uses (accounting settings). */
  center_levels: number;
}

export interface StatementRunParams {
  date?: string;
  from?: string;
  to?: string;
  comparison?: boolean;
  approved_only?: boolean;
}

export interface DrillParams extends StatementRunParams {
  line: string;
  account_id?: number;
  center_level?: number;
}

export interface DrillRow {
  id: string;
  account_id: number;
  account_code: string | null;
  account_name: string | null;
  ledger_id: number | null;
  category_identifier: string | null;
  center_id: number | null;
  center_code: string | null;
  center_name: string | null;
  period: 'prior' | 'current' | null;
  reclassified: boolean;
  rule_ids: number[];
  /** Account rows: the center levels its balances have centers at. */
  center_levels?: number[];
  values: Record<string, string | null>;
}

export interface DrillResult {
  line: { key: string; label: string; kind: string; normal_side: string };
  level: 'account' | 'center';
  center_level: number | null;
  columns: RunColumn[];
  rows: DrillRow[];
  currency: RunCurrency;
}

export type GranteeType = 'Member' | 'Role' | 'Group' | 'Department';

export interface ReportGrant {
  id: number;
  report_id: number;
  grantee_type: GranteeType;
  grantee_id: number;
  grantee_name: string | null;
  access: 'view' | 'edit';
  created_at: string;
}

export interface ReportUpdatePayload {
  name?: Record<string, string>;
  description?: Record<string, string>;
  primary?: boolean;
}
