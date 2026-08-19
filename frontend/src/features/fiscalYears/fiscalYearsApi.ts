import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../app/baseQuery';

export interface FiscalYear {
  id: number;
  name: string;
  start_date: string;
  finish_date: string;
  t?: {
    name?: Record<string, string>;
  };
}

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