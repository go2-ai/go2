import { compactParams, reportingApi, runTags } from '../../reporting/reportingApi';
import type { TrialBalanceParams, TrialBalanceRun } from './types';

export const trialBalanceApi = reportingApi.injectEndpoints({
  endpoints: (builder) => ({
    runTrialBalance: builder.query<TrialBalanceRun, { organizationId: number; id: number; params: TrialBalanceParams }>({
      query: ({ organizationId, id, params }) => ({
        url: `/organizations/${organizationId}/reporting/reports/${id}/run`,
        params: compactParams({ ...params }),
      }),
      providesTags: (_r, _e, { id }) => runTags(id),
    }),
  }),
});

export const { useRunTrialBalanceQuery } = trialBalanceApi;
