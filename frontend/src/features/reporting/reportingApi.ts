import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../app/baseQuery';
import type {
  ReportSummary,
  StatementRun,
  StatementRunParams,
  DrillResult,
  DrillParams,
  ReportGrant,
  ReportUpdatePayload,
  GranteeType,
} from './types';

const reportsUrl = (organizationId: number) => `/organizations/${organizationId}/reporting/reports`;

/** Optional params: drop empty values so the server applies its defaults. */
export const compactParams = (params: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== ''));

/**
 * Tags of a run (statement, drill, trial balance, ratios, print): its own
 * report, and the list every run is in. A run can read other reports'
 * figures (ratios read statements), so changes invalidate the whole list.
 */
export const runTags = (id: number) => [
  { type: 'ReportRun' as const, id },
  { type: 'ReportRun' as const, id: 'LIST' as const },
];

export const reportingApi = createApi({
  reducerPath: 'reportingApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['Report', 'ReportRun', 'ReportGrant'],
  endpoints: (builder) => ({
    getReports: builder.query<ReportSummary[], { organizationId: number; archived?: boolean }>({
      query: ({ organizationId, archived }) => ({
        url: reportsUrl(organizationId),
        params: archived ? { archived: true } : {},
      }),
      providesTags: [{ type: 'Report', id: 'LIST' }],
    }),
    getReport: builder.query<ReportSummary, { organizationId: number; id: number }>({
      query: ({ organizationId, id }) => `${reportsUrl(organizationId)}/${id}`,
      providesTags: (_result, _error, { id }) => [{ type: 'Report', id }],
    }),
    runStatement: builder.query<StatementRun, { organizationId: number; id: number; params: StatementRunParams }>({
      query: ({ organizationId, id, params }) => ({
        url: `${reportsUrl(organizationId)}/${id}/run`,
        params: compactParams({ ...params }),
      }),
      providesTags: (_result, _error, { id }) => runTags(id),
    }),
    drillStatement: builder.query<DrillResult, { organizationId: number; id: number; params: DrillParams }>({
      query: ({ organizationId, id, params }) => ({
        url: `${reportsUrl(organizationId)}/${id}/drill`,
        params: compactParams({ ...params }),
      }),
      providesTags: (_result, _error, { id }) => runTags(id),
    }),
    /** Data of the report's print template (view=print), in the template's language. */
    getReportPrint: builder.query<unknown, { organizationId: number; id: number; source: string | null; locale?: string }>({
      query: ({ organizationId, id, source, locale }) => ({
        url: `${reportsUrl(organizationId)}/${id}/run`,
        params: { ...Object.fromEntries(new URLSearchParams(source ?? '')), view: 'print', ...(locale ? { locale } : {}) },
      }),
      providesTags: (_result, _error, { id }) => runTags(id),
    }),
    copyReport: builder.mutation<ReportSummary, { organizationId: number; id: number; name?: Record<string, string> }>({
      query: ({ organizationId, id, name }) => ({
        url: `${reportsUrl(organizationId)}/${id}/copy`,
        method: 'POST',
        body: name ? { name } : {},
      }),
      invalidatesTags: [
        { type: 'Report', id: 'LIST' },
        { type: 'ReportRun', id: 'LIST' },
      ],
    }),
    updateReport: builder.mutation<ReportSummary, { organizationId: number; id: number; data: ReportUpdatePayload }>({
      query: ({ organizationId, id, data }) => ({ url: `${reportsUrl(organizationId)}/${id}`, method: 'PATCH', body: data }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Report', id },
        { type: 'Report', id: 'LIST' },
        { type: 'ReportRun', id },
        { type: 'ReportRun', id: 'LIST' },
      ],
    }),
    archiveReport: builder.mutation<ReportSummary, { organizationId: number; id: number; archived: boolean }>({
      query: ({ organizationId, id, archived }) => ({
        url: `${reportsUrl(organizationId)}/${id}/${archived ? 'archive' : 'unarchive'}`,
        method: 'POST',
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Report', id },
        { type: 'Report', id: 'LIST' },
        { type: 'ReportRun', id: 'LIST' },
      ],
    }),
    deleteReport: builder.mutation<void, { organizationId: number; id: number }>({
      query: ({ organizationId, id }) => ({ url: `${reportsUrl(organizationId)}/${id}`, method: 'DELETE' }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'Report', id },
        { type: 'Report', id: 'LIST' },
        { type: 'ReportRun', id: 'LIST' },
      ],
    }),
    getReportGrants: builder.query<ReportGrant[], { organizationId: number; reportId: number }>({
      query: ({ organizationId, reportId }) => `${reportsUrl(organizationId)}/${reportId}/grants`,
      providesTags: (_result, _error, { reportId }) => [{ type: 'ReportGrant', id: reportId }],
    }),
    createReportGrant: builder.mutation<
      ReportGrant,
      { organizationId: number; reportId: number; granteeType: GranteeType; granteeId: number; access: 'view' | 'edit' }
    >({
      query: ({ organizationId, reportId, granteeType, granteeId, access }) => ({
        url: `${reportsUrl(organizationId)}/${reportId}/grants`,
        method: 'POST',
        body: { grantee_type: granteeType, grantee_id: granteeId, access },
      }),
      invalidatesTags: (_result, _error, { reportId }) => [{ type: 'ReportGrant', id: reportId }],
    }),
    deleteReportGrant: builder.mutation<void, { organizationId: number; reportId: number; id: number }>({
      query: ({ organizationId, reportId, id }) => ({
        url: `${reportsUrl(organizationId)}/${reportId}/grants/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { reportId }) => [{ type: 'ReportGrant', id: reportId }],
    }),
  }),
});

export const {
  useGetReportPrintQuery,
  useCopyReportMutation,
  useUpdateReportMutation,
  useArchiveReportMutation,
  useDeleteReportMutation,
  useGetReportGrantsQuery,
  useCreateReportGrantMutation,
  useDeleteReportGrantMutation,
} = reportingApi;

export const { useGetReportsQuery, useGetReportQuery, useRunStatementQuery, useDrillStatementQuery, useLazyDrillStatementQuery } =
  reportingApi;

/** Report keys of the print templates, by report type. */
export const PRINT_KEYS: Record<string, string> = {
  'accounting.statement': 'financial_statement',
  'accounting.trial_balance': 'trial_balance',
  'accounting.ratios': 'financial_ratios',
};

/** Run params as the print "source" (a query string). */
export const printSource = (params: object) =>
  new URLSearchParams(
    Object.entries(compactParams({ ...params })).map(([key, value]) => [key, String(value)])
  ).toString();
