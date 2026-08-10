import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../../app/baseQuery';

export interface AccountingCurrency {
  id: number;
  abr: string;
  decimal_digits: number;
  name: string;
  t?: {
    name?: Record<string, string>;
  };
}

export const accountingCurrenciesApi = createApi({
  reducerPath: 'accountingCurrenciesApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['AccountingCurrency'],
  endpoints: (builder) => ({
    getCurrencies: builder.query<AccountingCurrency[], number>({
      query: (organizationId) =>
        `/organizations/${organizationId}/accounting/currencies`,
      providesTags: ['AccountingCurrency'],
    }),

    createCurrency: builder.mutation<
      AccountingCurrency,
      { organizationId: number; data: Record<string, any> }
    >({
      query: ({ organizationId, data }) => ({
        url: `/organizations/${organizationId}/accounting/currencies`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['AccountingCurrency'],
    }),

    updateCurrency: builder.mutation<
      AccountingCurrency,
      { organizationId: number; id: number; data: Record<string, any> }
    >({
      query: ({ organizationId, id, data }) => ({
        url: `/organizations/${organizationId}/accounting/currencies/${id}`,
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['AccountingCurrency'],
    }),

    deleteCurrency: builder.mutation<
      void,
      { organizationId: number; id: number }
    >({
      query: ({ organizationId, id }) => ({
        url: `/organizations/${organizationId}/accounting/currencies/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AccountingCurrency'],
    }),
  }),
});

export const {
  useGetCurrenciesQuery,
  useCreateCurrencyMutation,
  useUpdateCurrencyMutation,
  useDeleteCurrencyMutation,
} = accountingCurrenciesApi;