import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../../app/baseQuery';

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
  currency_id: number;
  rate: number;
  currency_amount: number;
  account_code?: string;
  account_name?: string;
  t?: {
    description?: Record<string, string>;
  };
}

export interface JournalEntry {
  id: number;
  date: string;
  effective_date: string;
  fiscal_year_id: number;
  no: string;
  ref: string;
  daily_no: number;
  state: 'draft' | 'booked' | 'approved';
  entry_type: 'normal' | 'beginning' | 'ending';
  debit: number;
  credit: number;
  organization_id: number;
  creator_id: number | null;
  created_at: string;
  creator_name: string;
  t?: {
    description?: Record<string, string>;
  };
  items: JournalEntryItem[];
}

export interface JournalEntryPayload {
  date?: string;
  effective_date?: string;
  fiscal_year_id?: number;
  state?: 'draft' | 'booked';
  entry_type?: 'normal';
  description_en?: string;
  description_fa?: string;
  items_attributes?: Array<{
    id?: number;
    row?: number;
    account_id?: number | null;
    center1_id?: number | null;
    center2_id?: number | null;
    center3_id?: number | null;
    center4_id?: number | null;
    center5_id?: number | null;
    center6_id?: number | null;
    debit?: number;
    credit?: number;
    currency_id?: number;
    rate?: number | null;
    currency_amount?: number | null;
    description_en?: string;
    description_fa?: string;
    _destroy?: boolean;
  }>;
}

export const journalEntriesApi = createApi({
  reducerPath: 'journalEntriesApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['JournalEntry'],
  endpoints: (builder) => ({
    getJournalEntries: builder.query<
      JournalEntry[],
      { organizationId: number; fiscalYearId?: number }
    >({
      query: ({ organizationId, fiscalYearId }) => {
        const params = new URLSearchParams();
        if (fiscalYearId) params.append('fiscal_year_id', String(fiscalYearId));
        const qs = params.toString();
        return `/organizations/${organizationId}/accounting/journal_entries${qs ? `?${qs}` : ''}`;
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'JournalEntry' as const, id })),
              { type: 'JournalEntry', id: 'LIST' },
            ]
          : [{ type: 'JournalEntry', id: 'LIST' }],
    }),

    getJournalEntry: builder.query<
      JournalEntry,
      { organizationId: number; id: number }
    >({
      query: ({ organizationId, id }) =>
        `/organizations/${organizationId}/accounting/journal_entries/${id}`,
      providesTags: (result, error, { id }) => [{ type: 'JournalEntry', id }],
    }),

    createJournalEntry: builder.mutation<
      JournalEntry,
      { organizationId: number; data: JournalEntryPayload }
    >({
      query: ({ organizationId, data }) => ({
        url: `/organizations/${organizationId}/accounting/journal_entries`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'JournalEntry', id: 'LIST' }],
    }),

    updateJournalEntry: builder.mutation<
      JournalEntry,
      { organizationId: number; id: number; data: JournalEntryPayload }
    >({
      query: ({ organizationId, id, data }) => ({
        url: `/organizations/${organizationId}/accounting/journal_entries/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'JournalEntry', id },
        { type: 'JournalEntry', id: 'LIST' },
      ],
    }),

    deleteJournalEntry: builder.mutation<
      void,
      { organizationId: number; id: number }
    >({
      query: ({ organizationId, id }) => ({
        url: `/organizations/${organizationId}/accounting/journal_entries/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'JournalEntry', id: 'LIST' }],
    }),

    approveJournalEntry: builder.mutation<
      JournalEntry,
      { organizationId: number; id: number }
    >({
      query: ({ organizationId, id }) => ({
        url: `/organizations/${organizationId}/accounting/journal_entries/${id}/approve`,
        method: 'PATCH',
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'JournalEntry', id },
        { type: 'JournalEntry', id: 'LIST' },
      ],
    }),

    unapproveJournalEntry: builder.mutation<
      JournalEntry,
      { organizationId: number; id: number }
    >({
      query: ({ organizationId, id }) => ({
        url: `/organizations/${organizationId}/accounting/journal_entries/${id}/unapprove`,
        method: 'PATCH',
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'JournalEntry', id },
        { type: 'JournalEntry', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetJournalEntriesQuery,
  useGetJournalEntryQuery,
  useCreateJournalEntryMutation,
  useUpdateJournalEntryMutation,
  useDeleteJournalEntryMutation,
  useApproveJournalEntryMutation,
  useUnapproveJournalEntryMutation,
} = journalEntriesApi;