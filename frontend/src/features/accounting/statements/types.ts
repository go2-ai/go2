import type { RunCheck, RunColumn } from '../../reporting/types';

export type LineKind = 'heading' | 'mapped' | 'formula';
export type NormalSide = 'debit' | 'credit';
export type SelectorType = 'category' | 'ledger' | 'account' | 'account_range' | 'profit_or_loss';

export interface LayoutLine {
  id: number;
  key: string;
  parent_id: number | null;
  position: number;
  kind: LineKind;
  normal_side: NormalSide;
  label: string;
  labels: Record<string, string>;
  formula: string | null;
  style: { bold?: boolean; underline?: boolean; hide_if_zero?: boolean; hidden?: boolean };
  metadata: Record<string, unknown>;
}

export interface RuleSelector {
  ids?: number[];
  identifiers?: string[];
  settings?: string[];
  from?: string;
  to?: string;
  period?: 'prior' | 'current';
}

export interface LayoutRule {
  id: number;
  number: number;
  statement_line_id: number;
  line_key: string;
  opposite_line_id: number | null;
  opposite_line_key: string | null;
  selector_type: SelectorType;
  selector: RuleSelector;
  center_level: number | null;
  center_ids: number[];
  center_type_ids: number[];
  currency_ids: number[];
  grain: string;
  measure: string;
  priority: number | null;
  position: number;
  specificity: number;
  note: string | null;
}

export interface ChartItem {
  id: number;
  code: string;
  name: string;
}

export interface LayoutChart {
  categories: Array<ChartItem & { identifier: string | null; type: string }>;
  ledgers: Array<ChartItem & { category_id: number }>;
  accounts: Array<ChartItem & { ledger_id: number }>;
  center_types: Array<{ id: number; name: string }>;
  centers: Array<ChartItem & { center_type_id: number }>;
  currencies: Array<{ id: number; abr: string }>;
  setting_accounts: string[];
}

export interface LayoutPayload {
  report_id: number;
  statement_type: string | null;
  settings: Record<string, unknown>;
  center_levels: number;
  lines: LayoutLine[];
  rules: LayoutRule[];
  chart: LayoutChart;
  can_edit?: boolean;
  /** Rules (and the AI assistant): they may map any account. */
  can_edit_mapping?: boolean;
  /** The inspection list of every balance. */
  can_inspect?: boolean;
  line_id?: number;
  rule_id?: number;
}

export interface LinePayload {
  key?: string;
  parent_id?: number | null;
  kind?: LineKind;
  normal_side?: NormalSide;
  formula?: string | null;
  label?: Record<string, string>;
  style?: LayoutLine['style'];
}

export interface RulePayload {
  statement_line_id: number;
  opposite_line_id?: number | null;
  selector_type: SelectorType;
  selector: RuleSelector;
  center_level?: number | null;
  center_ids?: number[];
  center_type_ids?: number[];
  currency_ids?: number[];
  grain?: string;
  measure?: string;
  priority?: number | null;
  note?: string | null;
}

export interface InspectionRow {
  id: string;
  account_id: number;
  account_code: string | null;
  account_name: string | null;
  ledger_id: number | null;
  ledger_code: string | null;
  ledger_name: string | null;
  category_identifier: string | null;
  category_name: string | null;
  centers: Array<{ id: number; code: string; name: string } | null>;
  currency_id: number;
  currency: string | null;
  period: 'prior' | 'current' | null;
  balance: string;
  line_key: string | null;
  line_label: string | null;
  rule_id: number | null;
  rule_number: number | null;
  overridden_rule_ids: number[];
  overridden_rule_numbers: number[];
  conflicting_rule_ids: number[];
  reclassified: boolean;
  group_total: string | null;
  unmapped: boolean;
  out_of_scope: boolean;
  proposed_line_key?: string | null;
  proposed_line_label?: string | null;
  proposed_rule_id?: string | null;
  proposed_reclassified?: boolean;
  changed?: boolean;
}

export interface InspectionResult {
  column: RunColumn;
  center_levels: number;
  rows: InspectionRow[];
  checks: RunCheck[];
  proposed_checks: RunCheck[] | null;
  currency: { decimal_digits: number };
}

export interface InspectionParams {
  date?: string;
  from?: string;
  to?: string;
  column?: string;
  comparison?: boolean;
  approved_only?: boolean;
  /** JSON list of proposed rules (previews). */
  proposed_rules?: string;
}
