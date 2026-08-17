import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../../app/baseQuery';

export interface Ledger {
  id: number;
  code: string;
  name: string;
  account_category_id: number;
  contra_for_id: number | null;
  unexpected_balance: 'accept' | 'warn' | 'disallow';
  is_monetary: boolean;
  t?: {
    name?: Record<string, string>;
  };
}

export const accountingLedgersApi = createApi({
  reducerPath: 'accountingLedgersApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['AccountingLedger'],
  endpoints: (builder) => ({
    getLedgers: builder.query<Ledger[], number>({
      query: (organizationId) =>
        `/organizations/${organizationId}/accounting/ledgers`,
      providesTags: ['AccountingLedger'],
    }),

    createLedger: builder.mutation<
      Ledger,
      { organizationId: number; data: Record<string, any> }
    >({
      query: ({ organizationId, data }) => ({
        url: `/organizations/${organizationId}/accounting/ledgers`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['AccountingLedger'],
    }),

    updateLedger: builder.mutation<
      Ledger,
      { organizationId: number; id: number; data: Record<string, any> }
    >({
      query: ({ organizationId, id, data }) => ({
        url: `/organizations/${organizationId}/accounting/ledgers/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['AccountingLedger'],
    }),

    deleteLedger: builder.mutation<
      void,
      { organizationId: number; id: number }
    >({
      query: ({ organizationId, id }) => ({
        url: `/organizations/${organizationId}/accounting/ledgers/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AccountingLedger'],
    }),
  }),
});

export const {
  useGetLedgersQuery,
  useCreateLedgerMutation,
  useUpdateLedgerMutation,
  useDeleteLedgerMutation,
} = accountingLedgersApi;