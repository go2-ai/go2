import { compactParams, reportingApi, runTags } from '../../reporting/reportingApi';
import type { RunCurrency } from '../../reporting/types';

export interface RatioResult {
  key: string;
  group: 'liquidity' | 'leverage' | 'profitability' | 'efficiency';
  format: 'ratio' | 'percent' | 'days';
  formula: string;
  name: string;
  description: string;
  values: Record<string, string>;
  reasons: Record<string, string>;
  components: Record<string, Record<string, string | null>>;
  component_lines: Record<string, { report_id: number | null; line_key: string; label: string | null; opening: boolean }>;
  missing?: string[];
}

export interface RatiosRun {
  columns: Array<{ key: string; from: string; to: string }>;
  /** Statements the user can't open come without id and name. */
  sources: Record<string, { id: number | null; name: string | null; accessible: boolean } | null>;
  ratios: RatioResult[];
  /** Currency of the component amounts, when the server sends it. */
  currency?: RunCurrency;
}

export interface RatiosParams {
  from?: string;
  to?: string;
  comparison?: boolean;
}

export const ratiosApi = reportingApi.injectEndpoints({
  endpoints: (builder) => ({
    runRatios: builder.query<RatiosRun, { organizationId: number; id: number; params: RatiosParams }>({
      query: ({ organizationId, id, params }) => ({
        url: `/organizations/${organizationId}/reporting/reports/${id}/run`,
        params: compactParams({ ...params }),
      }),
      providesTags: (_r, _e, { id }) => runTags(id),
    }),
  }),
});

export const { useRunRatiosQuery } = ratiosApi;
