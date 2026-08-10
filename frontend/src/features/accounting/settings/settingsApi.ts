import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../../app/baseQuery';

export interface AccountingSetting {
  id: number;
  main_currency_id: number | null;
  use_parent_org_currencies: boolean;
  use_parent_org_accounts: boolean;
  use_parent_org_centers: boolean;
  use_parent_org_fiscal_years: boolean;
  account_category_length: number;
  ledger_length: number;
  account_length: number;
  center_length: number;
  center_levels: number;
}

export const accountingSettingsApi = createApi({
  reducerPath: 'accountingSettingsApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['AccountingSetting'],
  endpoints: (builder) => ({
    getAccountingSettings: builder.query<AccountingSetting, number>({
      query: (organizationId) =>
        `/organizations/${organizationId}/accounting/settings`,
      providesTags: ['AccountingSetting'],
    }),

    updateAccountingSettings: builder.mutation<
      AccountingSetting,
      { organizationId: number; data: Partial<AccountingSetting> }
    >({
      query: ({ organizationId, data }) => ({
        url: `/organizations/${organizationId}/accounting/settings`,
        method: 'PATCH',
        body: { accounting_setting: data },
      }),
      invalidatesTags: ['AccountingSetting'],
    }),
  }),
});

export const {
  useGetAccountingSettingsQuery,
  useUpdateAccountingSettingsMutation,
} = accountingSettingsApi;