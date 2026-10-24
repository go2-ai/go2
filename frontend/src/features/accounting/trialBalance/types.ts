import type { EntrySelection, RunCheck } from '../../reporting/types';

export type TrialBalanceLevel = 'category' | 'ledger' | 'account';

export interface TrialBalanceAmounts {
  opening_debit: string;
  opening_credit: string;
  debit: string;
  credit: string;
  closing_debit: string;
  closing_credit: string;
}

export interface TrialBalanceRow extends TrialBalanceAmounts {
  id: string;
  level: TrialBalanceLevel;
  level_id: number | null;
  /** Results of the years before the period's fiscal year. */
  prior_result: boolean;
  code: string | null;
  name: string | null;
  center_id: number | null;
  center_code: string | null;
  center_name: string | null;
}

export interface TrialBalanceRun {
  from: string;
  to: string;
  level: TrialBalanceLevel;
  center_level: number | null;
  entries: { opening: EntrySelection | null; period: EntrySelection };
  rows: TrialBalanceRow[];
  totals: TrialBalanceAmounts;
  checks: RunCheck[];
  currency: { abr: string | null; decimal_digits: number };
  /** Center levels the organization uses (accounting settings). */
  center_levels: number;
}

export interface TrialBalanceParams {
  from?: string;
  to?: string;
  level?: TrialBalanceLevel;
  center_level?: number;
  hide_zero?: boolean;
  approved_only?: boolean;
}
