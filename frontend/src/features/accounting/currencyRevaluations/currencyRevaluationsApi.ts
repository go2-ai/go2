import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../../app/baseQuery';
import { fiscalYearClosingApi } from '../fiscalYearClosing/fiscalYearClosingApi';

export type RevaluationKind = 'temporary' | 'permanent';
export type RevaluationStatus = 'draft' | 'posted' | 'superseded';
export type ExcludedReason =
  | 'missing_rate'
  | 'missing_fx_account'
  | 'center_mismatch'
  | 'blocked_by_unapproved'
  | 'locked_by_permanent';

/** Blank dimensions mean "all monetary accounts in foreign currencies". */
export interface RevaluationScope {
  account_ids?: number[];
  ledger_ids?: number[];
  currency_ids?: number[];
  /** Centers at any level. */
  center_ids?: number[];
  center1_ids?: number[];
  center2_ids?: number[];
  center3_ids?: number[];
  center4_ids?: number[];
  center5_ids?: number[];
  center6_ids?: number[];
}

/** Decimals are strings to keep full precision. */
export interface RevaluationItem {
  id: number;
  account_id: number;
  currency_id: number;
  center1_id: number | null;
  center2_id: number | null;
  center3_id: number | null;
  center4_id: number | null;
  center5_id: number | null;
  center6_id: number | null;
  currency_balance: string;
  book_base_balance: string;
  rate: string | null;
  rate_date: string | null;
  revalued_base_balance: string | null;
  difference: string;
  gain_loss_account_id: number | null;
  excluded: boolean;
  excluded_reason: ExcludedReason | null;
  /** Left out by the user: not posted, can be brought back while draft. */
  removed: boolean;
}

/** { locale => template }. */
export type LineTemplate = Record<string, string>;

/** Revaluation lines (item, counter) and closing entry lines (the others). */
export type RevaluationLineTemplateKind = 'item' | 'counter';
export type ClosingLineTemplateKind = 'closing' | 'closing_offset' | 'ending' | 'beginning';
export type LineTemplateKind = RevaluationLineTemplateKind | ClosingLineTemplateKind;

/**
 * Variables a line description template may use, per line kind (mirrors
 * Revaluation::LineDescriptions and Closing::LineDescriptions).
 */
const CENTER_VARIABLES = [1, 2, 3, 4, 5, 6].flatMap((level) => [`center${level}_code`, `center${level}_name`]);
const CLOSING_VARIABLES = ['fiscal_year', 'next_fiscal_year', 'date', 'account_code', 'account_name', 'currency',
  'currency_amount', ...CENTER_VARIABLES];
export const LINE_TEMPLATE_VARIABLES: Record<LineTemplateKind, string[]> = {
  item: ['as_of_date', 'account_code', 'account_name', 'currency', 'currency_balance', 'book_balance', 'rate', 'rate_date',
    'revalued_balance', 'difference', ...CENTER_VARIABLES],
  counter: ['as_of_date', 'account_code', 'account_name', 'difference', ...CENTER_VARIABLES],
  closing: CLOSING_VARIABLES,
  closing_offset: CLOSING_VARIABLES,
  ending: CLOSING_VARIABLES,
  beginning: CLOSING_VARIABLES,
};
export const LINE_TEMPLATE_MAX_LENGTH = 300;

export interface CurrencyRevaluation {
  id: number;
  fiscal_year_id: number;
  as_of_date: string;
  kind: RevaluationKind;
  status: RevaluationStatus;
  scope: RevaluationScope;
  journal_entry_id: number | null;
  journal_entry_no: string | null;
  journal_entry_ref: string | null;
  total_difference: string;
  items_count: number;
  excluded_count: number;
  removed_count: number;
  posted_at: string | null;
  superseded_at: string | null;
  created_at: string;
  t?: { description?: Record<string, string> };
  items?: RevaluationItem[];
  /** Only in the detail. Blank locales use default_line_templates. */
  line_description_template?: LineTemplate;
  counter_line_description_template?: LineTemplate;
  default_line_templates?: Record<LineTemplateKind, LineTemplate>;
}

/** Data for the printed report (Ariana Reports template `currency_revaluation`). */
export type CurrencyRevaluationPrint = Record<string, unknown> & { items: Array<Record<string, unknown>> };

export interface RevaluationError {
  errors: string[];
  code?: string;
  details?: { items?: Array<{ item_id: number; reason: ExcludedReason }> };
}

export type OnUnapproved = 'skip' | 'post_temporary' | 'partial';
export type ScheduleRunStatus = 'posted' | 'no_change' | 'skipped' | 'blocked' | 'failed';

/** Times are ISO 8601 in the organization's time zone (with offset). */
export interface RevaluationSchedule {
  id: number;
  name: string;
  rrule: string;
  dtstart: string;
  scope: RevaluationScope;
  default_kind: RevaluationKind;
  on_unapproved: OnUnapproved;
  active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
  last_run_status: ScheduleRunStatus | null;
  last_run_details: Record<string, string | number>;
  last_revaluation_id: number | null;
  upcoming_runs: string[];
}

export interface SchedulePayload {
  name?: string;
  rrule?: string;
  /** Local date-time of the organization, e.g. "2026-10-31T23:00". */
  dtstart?: string;
  scope?: RevaluationScope;
  default_kind?: RevaluationKind;
  on_unapproved?: OnUnapproved;
  active?: boolean;
}

export interface SchedulePreview {
  valid: boolean;
  errors: string[];
  rrule: string | null;
  dtstart: string | null;
  upcoming_runs: string[];
}

export interface ScheduleRunResult {
  status: ScheduleRunStatus;
  details: Record<string, string | number>;
  revaluation_id: number | null;
  schedule: RevaluationSchedule;
}

const base = (organizationId: number) => `/organizations/${organizationId}/accounting/currency_revaluations`;
const schedulesBase = (organizationId: number) =>
  `/organizations/${organizationId}/accounting/currency_revaluation_schedules`;

/** Posted revaluations feed the year-end closing check; refresh it after changes. */
const refreshClosing = async (
  _arg: unknown,
  { dispatch, queryFulfilled }: { dispatch: (action: unknown) => unknown; queryFulfilled: Promise<unknown> }
) => {
  try {
    await queryFulfilled;
    dispatch(fiscalYearClosingApi.util.invalidateTags(['FiscalYearClosing']));
  } catch {
    // The mutation's own error handling reports failures.
  }
};

export const currencyRevaluationsApi = createApi({
  reducerPath: 'currencyRevaluationsApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['CurrencyRevaluation', 'RevaluationSchedule'],
  endpoints: (builder) => ({
    getRevaluationSchedules: builder.query<RevaluationSchedule[], number>({
      query: (organizationId) => schedulesBase(organizationId),
      providesTags: ['RevaluationSchedule'],
    }),
    createRevaluationSchedule: builder.mutation<RevaluationSchedule, { organizationId: number; data: SchedulePayload }>({
      query: ({ organizationId, data }) => ({ url: schedulesBase(organizationId), method: 'POST', body: data }),
      invalidatesTags: ['RevaluationSchedule'],
    }),
    updateRevaluationSchedule: builder.mutation<
      RevaluationSchedule,
      { organizationId: number; id: number; data: SchedulePayload }
    >({
      query: ({ organizationId, id, data }) => ({ url: `${schedulesBase(organizationId)}/${id}`, method: 'PATCH', body: data }),
      invalidatesTags: ['RevaluationSchedule'],
    }),
    deleteRevaluationSchedule: builder.mutation<{ id: number }, { organizationId: number; id: number }>({
      query: ({ organizationId, id }) => ({ url: `${schedulesBase(organizationId)}/${id}`, method: 'DELETE' }),
      invalidatesTags: ['RevaluationSchedule'],
    }),
    runRevaluationSchedule: builder.mutation<ScheduleRunResult, { organizationId: number; id: number }>({
      query: ({ organizationId, id }) => ({ url: `${schedulesBase(organizationId)}/${id}/run_now`, method: 'POST' }),
      invalidatesTags: ['RevaluationSchedule', 'CurrencyRevaluation'],
      onQueryStarted: refreshClosing,
    }),
    previewRevaluationSchedule: builder.mutation<
      SchedulePreview,
      { organizationId: number; rrule: string; dtstart: string }
    >({
      query: ({ organizationId, rrule, dtstart }) => ({
        url: `${schedulesBase(organizationId)}/preview`,
        method: 'POST',
        body: { rrule, dtstart },
      }),
    }),
    getCurrencyRevaluations: builder.query<
      CurrencyRevaluation[],
      { organizationId: number; fiscalYearId?: number | null }
    >({
      query: ({ organizationId, fiscalYearId }) => ({
        url: base(organizationId),
        params: fiscalYearId ? { fiscal_year_id: fiscalYearId } : {},
      }),
      providesTags: ['CurrencyRevaluation'],
    }),
    getCurrencyRevaluation: builder.query<CurrencyRevaluation, { organizationId: number; id: number }>({
      query: ({ organizationId, id }) => `${base(organizationId)}/${id}`,
      providesTags: (_result, _error, { id }) => [{ type: 'CurrencyRevaluation', id }],
    }),
    /** locale: language of the printed template; names and labels come in it. */
    getCurrencyRevaluationForPrint: builder.query<
      CurrencyRevaluationPrint,
      { organizationId: number; id: number; locale?: string }
    >({
      query: ({ organizationId, id, locale }) => ({
        url: `${base(organizationId)}/${id}`,
        params: { view: 'print', ...(locale ? { locale } : {}) },
      }),
      providesTags: (_result, _error, { id }) => [{ type: 'CurrencyRevaluation', id }],
    }),
    createCurrencyRevaluation: builder.mutation<
      CurrencyRevaluation,
      { organizationId: number; asOfDate: string; scope: RevaluationScope; kind: RevaluationKind }
    >({
      query: ({ organizationId, asOfDate, scope, kind }) => ({
        url: base(organizationId),
        method: 'POST',
        body: { as_of_date: asOfDate, scope, kind },
      }),
      invalidatesTags: ['CurrencyRevaluation'],
    }),
    updateCurrencyRevaluation: builder.mutation<
      CurrencyRevaluation,
      {
        organizationId: number;
        id: number;
        asOfDate?: string;
        scope?: RevaluationScope;
        kind?: RevaluationKind;
        items?: Array<{ id: number; gain_loss_account_id?: number | null; removed?: boolean }>;
        lineDescriptionTemplate?: LineTemplate;
        counterLineDescriptionTemplate?: LineTemplate;
      }
    >({
      query: ({ organizationId, id, asOfDate, scope, kind, items, lineDescriptionTemplate, counterLineDescriptionTemplate }) => ({
        url: `${base(organizationId)}/${id}`,
        method: 'PATCH',
        body: {
          ...(asOfDate ? { as_of_date: asOfDate } : {}),
          ...(scope ? { scope } : {}),
          ...(kind ? { kind } : {}),
          ...(items ? { items } : {}),
          ...(lineDescriptionTemplate ? { line_description_template: lineDescriptionTemplate } : {}),
          ...(counterLineDescriptionTemplate ? { counter_line_description_template: counterLineDescriptionTemplate } : {}),
        },
      }),
      invalidatesTags: (_result, _error, { id }) => ['CurrencyRevaluation', { type: 'CurrencyRevaluation', id }],
    }),
    rebuildCurrencyRevaluation: builder.mutation<CurrencyRevaluation, { organizationId: number; id: number }>({
      query: ({ organizationId, id }) => ({ url: `${base(organizationId)}/${id}/rebuild`, method: 'POST' }),
      invalidatesTags: (_result, _error, { id }) => ['CurrencyRevaluation', { type: 'CurrencyRevaluation', id }],
    }),
    postCurrencyRevaluation: builder.mutation<CurrencyRevaluation, { organizationId: number; id: number }>({
      query: ({ organizationId, id }) => ({ url: `${base(organizationId)}/${id}/post`, method: 'POST' }),
      invalidatesTags: (_result, _error, { id }) => ['CurrencyRevaluation', { type: 'CurrencyRevaluation', id }],
      onQueryStarted: refreshClosing,
    }),
    /** Posted revaluations only. */
    changeRevaluationKind: builder.mutation<
      CurrencyRevaluation,
      { organizationId: number; id: number; kind: RevaluationKind }
    >({
      query: ({ organizationId, id, kind }) => ({ url: `${base(organizationId)}/${id}/kind`, method: 'PATCH', body: { kind } }),
      invalidatesTags: (_result, _error, { id }) => ['CurrencyRevaluation', { type: 'CurrencyRevaluation', id }],
      onQueryStarted: refreshClosing,
    }),
    deleteCurrencyRevaluation: builder.mutation<{ id: number }, { organizationId: number; id: number }>({
      query: ({ organizationId, id }) => ({ url: `${base(organizationId)}/${id}`, method: 'DELETE' }),
      invalidatesTags: ['CurrencyRevaluation'],
      onQueryStarted: refreshClosing,
    }),
  }),
});

export const {
  useGetCurrencyRevaluationsQuery,
  useGetCurrencyRevaluationQuery,
  useGetCurrencyRevaluationForPrintQuery,
  useCreateCurrencyRevaluationMutation,
  useUpdateCurrencyRevaluationMutation,
  useRebuildCurrencyRevaluationMutation,
  usePostCurrencyRevaluationMutation,
  useChangeRevaluationKindMutation,
  useDeleteCurrencyRevaluationMutation,
  useGetRevaluationSchedulesQuery,
  useCreateRevaluationScheduleMutation,
  useUpdateRevaluationScheduleMutation,
  useDeleteRevaluationScheduleMutation,
  useRunRevaluationScheduleMutation,
  usePreviewRevaluationScheduleMutation,
} = currencyRevaluationsApi;
