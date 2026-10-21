import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../../app/baseQuery';
import type { FiscalYearClosingStep, FiscalYearStatus } from '../../fiscalYears/fiscalYearsApi';
import type { ClosingMethod } from '../settings/settingsApi';
import type { ClosingLineTemplateKind, ExcludedReason, LineTemplate } from '../currencyRevaluations/currencyRevaluationsApi';

export type ClosingWizardStep = FiscalYearClosingStep;

export type ReadinessBlocker =
  | 'not_open'
  | 'drafts'
  | 'unapproved_entries'
  | 'no_next_fiscal_year'
  | 'next_fiscal_year_not_open'
  | 'previous_fiscal_year_open'
  | 'settings_incomplete';

export interface ClosingFiscalYear {
  id: number;
  name: string;
  start_date: string;
  finish_date: string;
  status: FiscalYearStatus;
  closing_step: FiscalYearClosingStep | null;
  closing_started_at: string | null;
  closing_started_by_id: number | null;
  closed_at: string | null;
  closed_by_id: number | null;
}

export interface ClosingReadiness {
  ready: boolean;
  blockers: ReadinessBlocker[];
  drafts_count: number;
  booked_count: number;
  approved_count: number;
  next_fiscal_year: ClosingFiscalYear | null;
  previous_fiscal_year: ClosingFiscalYear | null;
  settings_errors: string[];
}

export interface ClosingSettingsSnapshot {
  closing_method: ClosingMethod;
  retained_earnings_account_id: number | null;
  income_summary_account_id: number | null;
  current_year_profit_account_id: number | null;
}

export interface ClosingEntrySummary {
  id: number;
  no: string;
  ref: string;
  date: string;
  entry_type: 'closing_temp_accounts' | 'ending' | 'beginning';
  fiscal_year_id: number;
  debit: string;
}

/** A balance of the year-end permanent revaluation dry run. Decimals are strings. */
export interface RevaluationCheckItem {
  account_id: number;
  currency_id: number;
  center_ids: Array<number | null>;
  currency_balance: string;
  book_base_balance: string;
  rate: string | null;
  revalued_base_balance: string | null;
  difference: string;
  excluded_reason: ExcludedReason | null;
}

export interface RevaluationCheckTemporary {
  id: number;
  as_of_date: string;
  journal_entry_id: number | null;
  journal_entry_no: string | null;
  journal_entry_ref: string | null;
  total_difference: string;
}

export interface RevaluationCheck {
  as_of_date: string;
  /** No temporaries left, and nothing remains or it was acknowledged. */
  passes: boolean;
  /** Nothing remains to be revalued and every balance has a rate. */
  clean: boolean;
  acknowledged: boolean;
  acknowledgment: { checksum: string; member_id: number | null; at: string; total_difference: string; missing_rates: number } | null;
  total_difference: string;
  temporaries: RevaluationCheckTemporary[];
  unrevalued: RevaluationCheckItem[];
  missing_rates: RevaluationCheckItem[];
  other_exclusions: RevaluationCheckItem[];
}

/** A line of a planned closing entry. Decimals are strings. */
export interface ClosingLine {
  account_id: number;
  currency_id: number;
  center_ids: Array<number | null>;
  debit: string;
  credit: string;
  currency_amount: string | null;
  rate: string | null;
}

export type TempClosingEntryKind = 'close_accounts' | 'close_income_summary';

export interface TempClosingPreview {
  closing_method: ClosingMethod;
  /** Profit (positive) or loss (negative) of the year, in the main currency. */
  net_result: string;
  checksum: string;
  postable: boolean;
  entries: Array<{ kind: TempClosingEntryKind; target_account_id: number; total: string; lines: ClosingLine[] }>;
  problems: Array<{
    reason: 'center_mismatch';
    account_id: number;
    center_ids: Array<number | null>;
    currency_id: number;
    target_account_id: number;
  }>;
}

export interface EndingPreview {
  checksum: string;
  postable: boolean;
  balanced: boolean;
  total: string;
  /** Income statement / income summary balances that must be closed first. */
  open_temporary: Array<{ account_id: number; center_ids: Array<number | null>; currency_id: number; base_balance: string }>;
  lines: ClosingLine[];
}

export type BeginningBlocker =
  | 'next_fiscal_year_missing'
  | 'next_fiscal_year_not_open'
  | 'beginning_entry_exists'
  | 'manual_beginning_entries'
  | 'next_year_permanent_revaluations';

export interface BeginningPreview {
  next_fiscal_year: ClosingFiscalYear | null;
  /** First day of the next year. */
  date: string | null;
  postable: boolean;
  blockers: BeginningBlocker[];
  total: string;
  lines: ClosingLine[];
  manual_beginning_entries: Array<{ id: number; no: string; ref: string; date: string }>;
  permanent_revaluations: Array<{ id: number; as_of_date: string }>;
}

export interface ClosingSummary {
  closed_at: string | null;
  closed_by_name: string | null;
  closing_method: ClosingMethod | null;
  net_result: string | null;
  next_fiscal_year_id: number | null;
}

export interface RenumberChange {
  id: number;
  ref: string;
  date: string;
  entry_type: string;
  no: string;
  new_no: string;
}

export interface RenumberPreview {
  entries_count: number;
  changed_count: number;
  /** At most 500; changed_count is the full number. */
  changes: RenumberChange[];
}

/** { kind => { locale => template } }. */
export type ClosingLineTemplates = Partial<Record<ClosingLineTemplateKind, LineTemplate>>;

export interface ClosingState {
  fiscal_year: ClosingFiscalYear;
  steps: ClosingWizardStep[];
  current_step: ClosingWizardStep;
  settings: ClosingSettingsSnapshot | null;
  /** Only while the year is open. */
  readiness: ClosingReadiness | null;
  /** Only at the revaluation step. */
  revaluation_check: RevaluationCheck | null;
  /** Only at the temp_closing step. */
  temp_closing: TempClosingPreview | null;
  /** Only at the ending step. */
  ending: EndingPreview | null;
  /** Only at the beginning step. */
  beginning: BeginningPreview | null;
  /** Only once the year is closed. */
  summary: ClosingSummary | null;
  /** Only at the renumber step. */
  renumber: RenumberPreview | null;
  /** Line description templates: this closing's own, and the defaults for blank locales. */
  line_templates: { own: ClosingLineTemplates; defaults: ClosingLineTemplates };
  /** The year receiving the beginning entry, if it exists. */
  next_fiscal_year: ClosingFiscalYear | null;
  /** Why the current step's preview can't be built (e.g. a closing account was deleted). */
  step_error: string | null;
  entries: ClosingEntrySummary[];
}

export interface ApproveAllResult {
  approved: number;
  failed: Array<{ id: number; no: string; ref: string; date: string; errors: string[] }>;
}

const base = (organizationId: number, fiscalYearId: number) =>
  `/organizations/${organizationId}/accounting/fiscal_year_closings/${fiscalYearId}`;

type Args = { organizationId: number; fiscalYearId: number };

export const fiscalYearClosingApi = createApi({
  reducerPath: 'fiscalYearClosingApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['FiscalYearClosing'],
  endpoints: (builder) => ({
    getClosingState: builder.query<ClosingState, Args>({
      query: ({ organizationId, fiscalYearId }) => base(organizationId, fiscalYearId),
      providesTags: (_r, _e, { fiscalYearId }) => [{ type: 'FiscalYearClosing', id: fiscalYearId }],
    }),
    approveAllEntries: builder.mutation<ApproveAllResult, Args>({
      query: ({ organizationId, fiscalYearId }) => ({ url: `${base(organizationId, fiscalYearId)}/approve_all`, method: 'POST' }),
      invalidatesTags: (_r, _e, { fiscalYearId }) => [{ type: 'FiscalYearClosing', id: fiscalYearId }],
    }),
    startClosing: builder.mutation<ClosingState, Args>({
      query: ({ organizationId, fiscalYearId }) => ({ url: `${base(organizationId, fiscalYearId)}/start`, method: 'POST' }),
      invalidatesTags: (_r, _e, { fiscalYearId }) => [{ type: 'FiscalYearClosing', id: fiscalYearId }],
    }),
    cancelClosing: builder.mutation<ClosingState, Args>({
      query: ({ organizationId, fiscalYearId }) => ({ url: `${base(organizationId, fiscalYearId)}/cancel`, method: 'POST' }),
      invalidatesTags: (_r, _e, { fiscalYearId }) => [{ type: 'FiscalYearClosing', id: fiscalYearId }],
    }),
    renumberEntries: builder.mutation<ClosingState, Args>({
      query: ({ organizationId, fiscalYearId }) => ({ url: `${base(organizationId, fiscalYearId)}/renumber`, method: 'POST' }),
      invalidatesTags: (_r, _e, { fiscalYearId }) => [{ type: 'FiscalYearClosing', id: fiscalYearId }],
    }),
    skipRenumber: builder.mutation<ClosingState, Args>({
      query: ({ organizationId, fiscalYearId }) => ({ url: `${base(organizationId, fiscalYearId)}/skip_renumber`, method: 'POST' }),
      invalidatesTags: (_r, _e, { fiscalYearId }) => [{ type: 'FiscalYearClosing', id: fiscalYearId }],
    }),
    updateClosingLineTemplate: builder.mutation<ClosingState, Args & { kind: ClosingLineTemplateKind; template: LineTemplate }>({
      query: ({ organizationId, fiscalYearId, kind, template }) => ({
        url: `${base(organizationId, fiscalYearId)}/line_templates`,
        method: 'PATCH',
        body: { kind, template },
      }),
      invalidatesTags: (_r, _e, { fiscalYearId }) => [{ type: 'FiscalYearClosing', id: fiscalYearId }],
    }),
    acknowledgeRevaluation: builder.mutation<ClosingState, Args>({
      query: ({ organizationId, fiscalYearId }) => ({
        url: `${base(organizationId, fiscalYearId)}/acknowledge_revaluation`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, { fiscalYearId }) => [{ type: 'FiscalYearClosing', id: fiscalYearId }],
    }),
    completeRevaluation: builder.mutation<ClosingState, Args>({
      query: ({ organizationId, fiscalYearId }) => ({
        url: `${base(organizationId, fiscalYearId)}/complete_revaluation`,
        method: 'POST',
      }),
      invalidatesTags: (_r, _e, { fiscalYearId }) => [{ type: 'FiscalYearClosing', id: fiscalYearId }],
    }),
    postTempClosing: builder.mutation<ClosingState, Args & { checksum: string }>({
      query: ({ organizationId, fiscalYearId, checksum }) => ({
        url: `${base(organizationId, fiscalYearId)}/post_temp_closing`,
        method: 'POST',
        body: { checksum },
      }),
      invalidatesTags: (_r, _e, { fiscalYearId }) => [{ type: 'FiscalYearClosing', id: fiscalYearId }],
    }),
    postEnding: builder.mutation<ClosingState, Args & { checksum: string }>({
      query: ({ organizationId, fiscalYearId, checksum }) => ({
        url: `${base(organizationId, fiscalYearId)}/post_ending`,
        method: 'POST',
        body: { checksum },
      }),
      invalidatesTags: (_r, _e, { fiscalYearId }) => [{ type: 'FiscalYearClosing', id: fiscalYearId }],
    }),
    postBeginning: builder.mutation<ClosingState, Args>({
      query: ({ organizationId, fiscalYearId }) => ({ url: `${base(organizationId, fiscalYearId)}/post_beginning`, method: 'POST' }),
      invalidatesTags: (_r, _e, { fiscalYearId }) => [{ type: 'FiscalYearClosing', id: fiscalYearId }],
    }),
    reopenFully: builder.mutation<ClosingState, Args>({
      query: ({ organizationId, fiscalYearId }) => ({ url: `${base(organizationId, fiscalYearId)}/reopen_fully`, method: 'POST' }),
      invalidatesTags: (_r, _e, { fiscalYearId }) => [{ type: 'FiscalYearClosing', id: fiscalYearId }],
    }),
    rollbackClosingStep: builder.mutation<ClosingState, Args>({
      query: ({ organizationId, fiscalYearId }) => ({ url: `${base(organizationId, fiscalYearId)}/rollback`, method: 'POST' }),
      invalidatesTags: (_r, _e, { fiscalYearId }) => [{ type: 'FiscalYearClosing', id: fiscalYearId }],
    }),
  }),
});

export const {
  useGetClosingStateQuery,
  useApproveAllEntriesMutation,
  useStartClosingMutation,
  useCancelClosingMutation,
  useAcknowledgeRevaluationMutation,
  useRenumberEntriesMutation,
  useSkipRenumberMutation,
  useUpdateClosingLineTemplateMutation,
  useCompleteRevaluationMutation,
  usePostTempClosingMutation,
  usePostEndingMutation,
  usePostBeginningMutation,
  useRollbackClosingStepMutation,
  useReopenFullyMutation,
} = fiscalYearClosingApi;
