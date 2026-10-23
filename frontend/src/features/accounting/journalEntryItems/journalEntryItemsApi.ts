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
  /** Codes and names of the selected records, for display only. */
  items?: { code: string; name: string }[];
}

export type ExplorerEntryType = 'normal' | 'beginning' | 'revaluation' | 'closing_temp_accounts' | 'ending';

/**
 * Which journal entries the explorer reads. When the period spans several
 * fiscal years the server ignores closing_temp_accounts and ending, and
 * beginning only selects the first year's beginning entry; includeYearEnd
 * adds the year-end and later beginning entries.
 */
export interface ExplorerScope {
  from: string;
  to: string;
  entryTypes: ExplorerEntryType[];
  includeYearEnd: boolean;
  approvedOnly: boolean;
}

export interface ExplorerMeta {
  from: string;
  to: string;
  fiscal_year_ids: number[];
  multi_year: boolean;
  /** The period starts after its first fiscal year's start. */
  prior_entries_excluded: boolean;
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
  meta: ExplorerMeta;
}

export interface ExplorerQueryArgs {
  organizationId: number;
  scope: ExplorerScope;
  groupBy: ExplorerDimension;
  filters: ExplorerFilter[];
  hideZeroBalance: boolean;
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
  scope: ExplorerScope;
  filters: ExplorerFilter[];
}

/** Server filters only need dimensions and ids. */
const filtersParam = (filters: ExplorerFilter[]) =>
  JSON.stringify(filters.map(({ dimension, ids }) => ({ dimension, ids })));

export const scopeParams = (scope: ExplorerScope) => ({
  from: scope.from,
  to: scope.to,
  entry_types: scope.entryTypes.join(','),
  include_year_end: scope.includeYearEnd,
  approved_only: scope.approvedOnly,
});

interface PrintArgs {
  locale?: string;
  ids?: number[] | null;
}

const printParams = ({ locale, ids }: PrintArgs) => ({
  ...(locale ? { locale } : {}),
  ...(ids && ids.length > 0 ? { ids: ids.join(',') } : {}),
});

export const journalEntryItemsApi = createApi({
  reducerPath: 'journalEntryItemsApi',
  baseQuery: baseQueryWithCsrf,
  endpoints: (builder) => ({
    getExplorerGroupedSummary: builder.query<ExplorerResponse, ExplorerQueryArgs>({
      query: ({ organizationId, scope, groupBy, filters, hideZeroBalance }) => ({
        url: `/organizations/${organizationId}/accounting/journal_entry_items/group_by`,
        method: 'GET',
        params: {
          ...scopeParams(scope),
          group_by: groupBy,
          filters: filtersParam(filters),
          hide_zero_balance: hideZeroBalance,
        },
      }),
    }),
    getJournalEntryItems: builder.query<JournalEntryItem[], JournalEntryItemsQueryArgs>({
      query: ({ organizationId, scope, filters }) => ({
        url: `/organizations/${organizationId}/accounting/journal_entry_items`,
        method: 'GET',
        params: {
          ...scopeParams(scope),
          filters: filtersParam(filters),
        },
      }),
    }),
    /**
     * Data of the explorer print; locale: language of the printed template,
     * ids: only these rows (ids of the grouped records).
     */
    getExplorerPrint: builder.query<ExplorerPrint, ExplorerQueryArgs & PrintArgs>({
      query: ({ organizationId, scope, groupBy, filters, hideZeroBalance, locale, ids }) => ({
        url: `/organizations/${organizationId}/accounting/journal_entry_items/group_by`,
        method: 'GET',
        params: {
          ...scopeParams(scope),
          group_by: groupBy,
          filters: filtersParam(filters),
          hide_zero_balance: hideZeroBalance,
          view: 'print',
          ...printParams({ locale, ids }),
        },
      }),
    }),
    /**
     * Data of the journal entry items print; locale: language of the printed
     * template, ids: only these items.
     */
    getJournalEntryItemsPrint: builder.query<JournalEntryItemsPrint, JournalEntryItemsQueryArgs & PrintArgs>({
      query: ({ organizationId, scope, filters, locale, ids }) => ({
        url: `/organizations/${organizationId}/accounting/journal_entry_items`,
        method: 'GET',
        params: {
          ...scopeParams(scope),
          filters: filtersParam(filters),
          view: 'print',
          ...printParams({ locale, ids }),
        },
      }),
    }),
  }),
});

/** What both explorer prints describe: the period, entry types, states and drill filters. */
export interface ExplorerPrintHeader {
  organization_name: string;
  from: string;
  to: string;
  entry_types: ExplorerEntryType[];
  entry_types_text: string;
  approved_only: boolean;
  states_text: string;
  filters: { dimension: ExplorerDimension; dimension_name: string; items_text: string }[];
  currency: { abr: string; name: string; names: Record<string, string>; decimal_digits: number } | null;
}

export interface ExplorerPrint extends ExplorerPrintHeader {
  group_by: ExplorerDimension;
  group_by_name: string;
  hide_zero_balance: boolean;
  total_debit: number;
  total_credit: number;
  total_debit_balance: number;
  total_credit_balance: number;
  rows: Omit<ExplorerRow, 'id'>[];
}

export interface JournalEntryItemsPrint extends ExplorerPrintHeader {
  total_debit: number;
  total_credit: number;
  items: {
    date: string;
    no: string;
    ref: string;
    row: number;
    account_code: string | null;
    account_name: string | null;
    centers: string;
    description: string | null;
    debit: number;
    credit: number;
    currency: string | null;
    currency_amount: number | null;
    rate: number | null;
  }[];
}

export const {
  useGetExplorerGroupedSummaryQuery,
  useGetJournalEntryItemsQuery,
  useGetExplorerPrintQuery,
  useGetJournalEntryItemsPrintQuery,
} = journalEntryItemsApi;
