import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../../app/baseQuery';

export type ExchangeRateProvider = 'manual' | 'ecb';

/** 1 unit of `currency_id` = `rate` units of the quote currency (main currency when null). */
export interface ExchangeRate {
  id: number;
  currency_id: number;
  quote_currency_id: number | null;
  date: string;
  /** Decimal string to keep full precision. */
  rate: string;
  source: ExchangeRateProvider;
  meta: Record<string, unknown>;
  created_by_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface ResolvedRate {
  currency_id: number;
  /** In the main currency; null when no rate is available. */
  rate: string | null;
  /** Date of the oldest stored rate used. */
  rate_date: string | null;
  sources: ExchangeRateProvider[];
  path: ExchangeRate[];
  error: 'missing' | 'cycle' | null;
}

export interface ResolvedRates {
  date: string;
  main_currency_id: number;
  rates: ResolvedRate[];
}

export interface ExchangeRateSource {
  id: number;
  currency_id: number;
  provider: ExchangeRateProvider;
  quote_currency_id: number | null;
  active: boolean;
}

/** Result of fetching provider rates. */
export interface FetchSummary {
  created: number;
  updated: number;
  unchanged: number;
  dates: string[];
  skipped: Array<{ currency_id: number; currency: string; reason: 'not_published'; codes: string[] }>;
}

/**
 * ISO codes in the ECB euro reference rates (plus EUR itself).
 * Used only to warn in the UI; the server decides from the actual feed.
 */
export const ECB_CURRENCIES = new Set([
  'EUR', 'USD', 'JPY', 'CZK', 'DKK', 'GBP', 'HUF', 'PLN', 'RON', 'SEK', 'CHF', 'ISK', 'NOK', 'TRY',
  'AUD', 'BRL', 'CAD', 'CNY', 'HKD', 'IDR', 'ILS', 'INR', 'KRW', 'MXN', 'MYR', 'NZD', 'PHP', 'SGD',
  'THB', 'ZAR',
]);

export interface ExchangeRatePayload {
  currency_id?: number;
  quote_currency_id?: number | null;
  date?: string;
  rate?: string;
}

export interface ExchangeRateSourcePayload {
  currency_id?: number;
  provider?: ExchangeRateProvider;
  quote_currency_id?: number | null;
  active?: boolean;
}

const base = (organizationId: number) => `/organizations/${organizationId}/accounting`;

export const exchangeRatesApi = createApi({
  reducerPath: 'exchangeRatesApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['ExchangeRate', 'ExchangeRateSource'],
  endpoints: (builder) => ({
    getExchangeRates: builder.query<
      ExchangeRate[],
      { organizationId: number; currencyId?: number | null; from?: string | null; to?: string | null }
    >({
      query: ({ organizationId, currencyId, from, to }) => ({
        url: `${base(organizationId)}/exchange_rates`,
        params: {
          ...(currencyId ? { currency_id: currencyId } : {}),
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
        },
      }),
      providesTags: ['ExchangeRate'],
    }),
    resolveExchangeRates: builder.query<ResolvedRates, { organizationId: number; date?: string | null }>({
      query: ({ organizationId, date }) => ({
        url: `${base(organizationId)}/exchange_rates/resolve`,
        params: date ? { date } : {},
      }),
      providesTags: ['ExchangeRate'],
    }),
    createExchangeRate: builder.mutation<ExchangeRate, { organizationId: number; data: ExchangeRatePayload }>({
      query: ({ organizationId, data }) => ({
        url: `${base(organizationId)}/exchange_rates`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['ExchangeRate'],
    }),
    updateExchangeRate: builder.mutation<
      ExchangeRate,
      { organizationId: number; id: number; data: ExchangeRatePayload }
    >({
      query: ({ organizationId, id, data }) => ({
        url: `${base(organizationId)}/exchange_rates/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['ExchangeRate'],
    }),
    deleteExchangeRate: builder.mutation<void, { organizationId: number; id: number }>({
      query: ({ organizationId, id }) => ({
        url: `${base(organizationId)}/exchange_rates/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ExchangeRate'],
    }),
    fetchExchangeRates: builder.mutation<
      FetchSummary,
      { organizationId: number; from?: string | null; to?: string | null }
    >({
      query: ({ organizationId, from, to }) => ({
        url: `${base(organizationId)}/exchange_rates/fetch`,
        method: 'POST',
        params: { ...(from ? { from } : {}), ...(to ? { to } : {}) },
      }),
      invalidatesTags: ['ExchangeRate'],
    }),
    getExchangeRateSources: builder.query<ExchangeRateSource[], number>({
      query: (organizationId) => `${base(organizationId)}/exchange_rate_sources`,
      providesTags: ['ExchangeRateSource'],
    }),
    createExchangeRateSource: builder.mutation<
      ExchangeRateSource,
      { organizationId: number; data: ExchangeRateSourcePayload }
    >({
      query: ({ organizationId, data }) => ({
        url: `${base(organizationId)}/exchange_rate_sources`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['ExchangeRateSource'],
    }),
    updateExchangeRateSource: builder.mutation<
      ExchangeRateSource,
      { organizationId: number; id: number; data: ExchangeRateSourcePayload }
    >({
      query: ({ organizationId, id, data }) => ({
        url: `${base(organizationId)}/exchange_rate_sources/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['ExchangeRateSource'],
    }),
  }),
});

export const {
  useGetExchangeRatesQuery,
  useResolveExchangeRatesQuery,
  useCreateExchangeRateMutation,
  useUpdateExchangeRateMutation,
  useDeleteExchangeRateMutation,
  useFetchExchangeRatesMutation,
  useGetExchangeRateSourcesQuery,
  useCreateExchangeRateSourceMutation,
  useUpdateExchangeRateSourceMutation,
} = exchangeRatesApi;
