import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../app/baseQuery';

export interface FiscalYear {
  id: number;
  name: string;
  start_date: string;
  finish_date: string;
  /** open: normal; closing: the closing wizard runs, entries are locked; closed: read-only. */
  status: FiscalYearStatus;
  /** Current step of the closing wizard; null while open. */
  closing_step: FiscalYearClosingStep | null;
  closing_started_at: string | null;
  closed_at: string | null;
  t?: {
    name?: Record<string, string>;
  };
}

export type FiscalYearStatus = 'open' | 'closing' | 'closed';

export type FiscalYearClosingStep =
  | 'readiness'
  | 'renumber'
  | 'revaluation'
  | 'temp_closing'
  | 'ending'
  | 'beginning'
  | 'finalized';

export const fiscalYearsApi = createApi({
  reducerPath: 'fiscalYearsApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['FiscalYear'],
  endpoints: (builder) => ({
    getFiscalYears: builder.query<FiscalYear[], number>({
      query: (organizationId) =>
        `/organizations/${organizationId}/fiscal_years`,
      providesTags: ['FiscalYear'],
    }),

    createFiscalYear: builder.mutation<
      FiscalYear,
      { organizationId: number; data: Record<string, any> }
    >({
      query: ({ organizationId, data }) => ({
        url: `/organizations/${organizationId}/fiscal_years`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['FiscalYear'],
    }),

    updateFiscalYear: builder.mutation<
      FiscalYear,
      { organizationId: number; id: number; data: Record<string, any> }
    >({
      query: ({ organizationId, id, data }) => ({
        url: `/organizations/${organizationId}/fiscal_years/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['FiscalYear'],
    }),

    deleteFiscalYear: builder.mutation<
      void,
      { organizationId: number; id: number }
    >({
      query: ({ organizationId, id }) => ({
        url: `/organizations/${organizationId}/fiscal_years/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['FiscalYear'],
    }),
  }),
});

export const {
  useGetFiscalYearsQuery,
  useCreateFiscalYearMutation,
  useUpdateFiscalYearMutation,
  useDeleteFiscalYearMutation,
} = fiscalYearsApi;