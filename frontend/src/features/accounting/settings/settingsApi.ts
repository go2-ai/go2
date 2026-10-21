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
  /** { locale => template }; blank locales use built_in_revaluation_line_templates. */
  revaluation_line_description_template: Record<string, string>;
  revaluation_counter_line_description_template: Record<string, string>;
  built_in_revaluation_line_templates: Record<'item' | 'counter', Record<string, string>>;
  /** { kind => { locale => template } } for closing entry lines; blank uses built_in_closing_line_templates. */
  closing_line_description_templates: Partial<Record<'closing' | 'closing_offset' | 'ending' | 'beginning', Record<string, string>>>;
  built_in_closing_line_templates: Record<'closing' | 'closing_offset' | 'ending' | 'beginning', Record<string, string>>;
  closing_method: ClosingMethod;
  retained_earnings_account_id: number | null;
  income_summary_account_id: number | null;
  current_year_profit_account_id: number | null;
  default_fx_gain_account_id: number | null;
  default_fx_loss_account_id: number | null;
  /** What is missing to close a fiscal year with these settings (read-only). */
  closing_configuration_errors: string[];
}

export type ClosingMethod = 'direct' | 'income_summary' | 'current_year_profit';

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