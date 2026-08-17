import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../../app/baseQuery';

export interface AccountCategory {
  id: number;
  code: string;
  identifier: string | null;
  type: string;
  name: string;
  ledgers_count?: number;
  t?: {
    name?: Record<string, string>;
  };
}

export const accountingAccountCategoriesApi = createApi({
  reducerPath: 'accountingAccountCategoriesApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['AccountingAccountCategory'],
  endpoints: (builder) => ({
    getAccountCategories: builder.query<AccountCategory[], number>({
      query: (organizationId) =>
        `/organizations/${organizationId}/accounting/account_categories`,
      providesTags: ['AccountingAccountCategory'],
    }),

    createAccountCategory: builder.mutation<
      AccountCategory,
      { organizationId: number; data: Record<string, any> }
    >({
      query: ({ organizationId, data }) => ({
        url: `/organizations/${organizationId}/accounting/account_categories`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['AccountingAccountCategory'],
    }),

    updateAccountCategory: builder.mutation<
      AccountCategory,
      { organizationId: number; id: number; data: Record<string, any> }
    >({
      query: ({ organizationId, id, data }) => ({
        url: `/organizations/${organizationId}/accounting/account_categories/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['AccountingAccountCategory'],
    }),

    deleteAccountCategory: builder.mutation<
      void,
      { organizationId: number; id: number }
    >({
      query: ({ organizationId, id }) => ({
        url: `/organizations/${organizationId}/accounting/account_categories/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AccountingAccountCategory'],
    }),
  }),
});

export const {
  useGetAccountCategoriesQuery,
  useCreateAccountCategoryMutation,
  useUpdateAccountCategoryMutation,
  useDeleteAccountCategoryMutation,
} = accountingAccountCategoriesApi;