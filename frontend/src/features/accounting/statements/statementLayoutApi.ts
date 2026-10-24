import { reportingApi, compactParams } from '../../reporting/reportingApi';
import type { InspectionParams, InspectionResult, LayoutPayload, LinePayload, RulePayload } from './types';

const base = (organizationId: number, reportId: number) =>
  `/organizations/${organizationId}/accounting/statements/${reportId}`;

type Ids = { organizationId: number; reportId: number };

// Every change answers with the whole layout; figures of the report change
// too, and so do those of runs reading it (ratios).
const changed = (_r: unknown, _e: unknown, { reportId }: Ids) => [
  { type: 'StatementLayout' as const, id: reportId },
  { type: 'ReportRun' as const, id: reportId },
  { type: 'ReportRun' as const, id: 'LIST' as const },
  { type: 'Inspection' as const, id: reportId },
];

export const statementLayoutApi = reportingApi.enhanceEndpoints({ addTagTypes: ['StatementLayout', 'Inspection'] }).injectEndpoints({
  endpoints: (builder) => ({
    getStatementLayout: builder.query<LayoutPayload, Ids>({
      query: ({ organizationId, reportId }) => `${base(organizationId, reportId)}/layout`,
      providesTags: (_r, _e, { reportId }) => [{ type: 'StatementLayout', id: reportId }],
    }),
    getInspection: builder.query<InspectionResult, Ids & { params: InspectionParams }>({
      query: ({ organizationId, reportId, params }) => ({
        url: `${base(organizationId, reportId)}/inspection`,
        params: compactParams({ ...params }),
      }),
      providesTags: (_r, _e, { reportId }) => [{ type: 'Inspection', id: reportId }],
    }),
    createLine: builder.mutation<LayoutPayload, Ids & { data: LinePayload }>({
      query: ({ organizationId, reportId, data }) => ({ url: `${base(organizationId, reportId)}/lines`, method: 'POST', body: data }),
      invalidatesTags: changed,
    }),
    updateLine: builder.mutation<LayoutPayload, Ids & { id: number; data: LinePayload }>({
      query: ({ organizationId, reportId, id, data }) => ({
        url: `${base(organizationId, reportId)}/lines/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: changed,
    }),
    moveLine: builder.mutation<LayoutPayload, Ids & { id: number; parentId: number | null; index: number }>({
      query: ({ organizationId, reportId, id, parentId, index }) => ({
        url: `${base(organizationId, reportId)}/lines/${id}/move`,
        method: 'POST',
        body: { parent_id: parentId, index },
      }),
      invalidatesTags: changed,
    }),
    deleteLine: builder.mutation<LayoutPayload, Ids & { id: number }>({
      query: ({ organizationId, reportId, id }) => ({ url: `${base(organizationId, reportId)}/lines/${id}`, method: 'DELETE' }),
      invalidatesTags: changed,
    }),
    createRule: builder.mutation<LayoutPayload, Ids & { data: RulePayload }>({
      query: ({ organizationId, reportId, data }) => ({ url: `${base(organizationId, reportId)}/rules`, method: 'POST', body: data }),
      invalidatesTags: changed,
    }),
    updateRule: builder.mutation<LayoutPayload, Ids & { id: number; data: RulePayload }>({
      query: ({ organizationId, reportId, id, data }) => ({
        url: `${base(organizationId, reportId)}/rules/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: changed,
    }),
    deleteRule: builder.mutation<LayoutPayload, Ids & { id: number }>({
      query: ({ organizationId, reportId, id }) => ({ url: `${base(organizationId, reportId)}/rules/${id}`, method: 'DELETE' }),
      invalidatesTags: changed,
    }),
  }),
});

export const {
  useGetStatementLayoutQuery,
  useGetInspectionQuery,
  useCreateLineMutation,
  useUpdateLineMutation,
  useMoveLineMutation,
  useDeleteLineMutation,
  useCreateRuleMutation,
  useUpdateRuleMutation,
  useDeleteRuleMutation,
} = statementLayoutApi;
