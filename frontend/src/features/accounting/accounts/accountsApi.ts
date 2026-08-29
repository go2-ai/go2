import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../../app/baseQuery';

export interface Account {
  id: number;
  code: string;
  full_code: string;
  name: string;
  ledger_id: number;
  contra_for_id: number | null;
  accepts_other_currencies: boolean;
  allowed_center_types_1: number[] | null;
  allowed_center_types_2: number[] | null;
  allowed_center_types_3: number[] | null;
  allowed_center_types_4: number[] | null;
  allowed_center_types_5: number[] | null;
  allowed_center_types_6: number[] | null;
  t?: {
    name?: Record<string, string>;
  };
}

export const accountingAccountsApi = createApi({
  reducerPath: 'accountingAccountsApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['AccountingAccount'],
  endpoints: (builder) => ({
    getAccounts: builder.query<Account[], number>({
      query: (organizationId) =>
        `/organizations/${organizationId}/accounting/accounts`,
      providesTags: ['AccountingAccount'],
    }),

    getAccount: builder.query<Account, { organizationId: number; id: number }>({
      query: ({ organizationId, id }) =>
        `/organizations/${organizationId}/accounting/accounts/${id}`,
      providesTags: (result, error, { id }) => [{ type: 'AccountingAccount', id }],
    }),

    createAccount: builder.mutation<
      Account,
      { organizationId: number; data: Record<string, any> }
    >({
      query: ({ organizationId, data }) => ({
        url: `/organizations/${organizationId}/accounting/accounts`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['AccountingAccount'],
    }),

    updateAccount: builder.mutation<
      Account,
      { organizationId: number; id: number; data: Record<string, any> }
    >({
      query: ({ organizationId, id, data }) => ({
        url: `/organizations/${organizationId}/accounting/accounts/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['AccountingAccount'],
    }),

    deleteAccount: builder.mutation<
      void,
      { organizationId: number; id: number }
    >({
      query: ({ organizationId, id }) => ({
        url: `/organizations/${organizationId}/accounting/accounts/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AccountingAccount'],
    }),
  }),
});

export const {
  useGetAccountsQuery,
  useGetAccountQuery,
  useCreateAccountMutation,
  useUpdateAccountMutation,
  useDeleteAccountMutation,
} = accountingAccountsApi;