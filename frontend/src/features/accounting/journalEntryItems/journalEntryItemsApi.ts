import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../../app/baseQuery';

export type ExplorerDimension =
  | 'account_category'
  | 'ledger'
  | 'account'
  | 'center1'
  | 'center2'
  | 'center3'
  | 'center4'
  | 'center5'
  | 'center6'
  | 'currency';

export interface ExplorerFilter {
  dimension: ExplorerDimension;
  ids: number[];
}

export interface ExplorerRow {
  id: number;
  code: string;
  name: string;
  sum_debit: number;
  sum_credit: number;
  debit_balance: number | null;
  credit_balance: number | null;
}

export interface ExplorerResponse {
  group_by: ExplorerDimension;
  rows: ExplorerRow[];
}

export interface ExplorerQueryArgs {
  organizationId: number;
  fiscalYearId: number;
  groupBy: ExplorerDimension;
  filters: ExplorerFilter[];
}

export interface JournalEntryItem {
  id: number;
  row: number;
  account_id: number | null;
  center1_id: number | null;
  center2_id: number | null;
  center3_id: number | null;
  center4_id: number | null;
  center5_id: number | null;
  center6_id: number | null;
  debit: number;
  credit: number;
  currency_id: number | null;
  abr: string;
  rate: number | null;
  currency_amount: number | null;
  account_code: string;
  account_name: string;
  t: { description: Record<string, string> };
  journal_entry: {
    id: number;
    date: string;
    no: string;
    ref: string;
  };
}

export interface JournalEntryItemsQueryArgs {
  organizationId: number;
  fiscalYearId: number;
  filters: ExplorerFilter[];
}

export interface ExplorerFilter {
  dimension: ExplorerDimension;
  ids: number[];
  items?: { code: string; name: string }[];
}

export const journalEntryItemsApi = createApi({
  reducerPath: 'journalEntryItemsApi',
  baseQuery: baseQueryWithCsrf,
  endpoints: (builder) => ({
    getExplorerGroupedSummary: builder.query<ExplorerResponse, ExplorerQueryArgs>({
      query: ({ organizationId, fiscalYearId, groupBy, filters }) => ({
        url: `/organizations/${organizationId}/accounting/journal_entry_items/group_by`,
        method: 'GET',
        params: {
          fiscal_year_id: fiscalYearId,
          group_by: groupBy,
          filters: JSON.stringify(filters),
        },
      }),
    }),
    getJournalEntryItems: builder.query<JournalEntryItem[], JournalEntryItemsQueryArgs>({
      query: ({ organizationId, fiscalYearId, filters }) => ({
        url: `/organizations/${organizationId}/accounting/journal_entry_items`,
        method: 'GET',
        params: {
          fiscal_year_id: fiscalYearId,
          filters: JSON.stringify(filters),
        },
      }),
    }),
  }),
});

export const {
  useGetExplorerGroupedSummaryQuery,
  useGetJournalEntryItemsQuery,
} = journalEntryItemsApi;