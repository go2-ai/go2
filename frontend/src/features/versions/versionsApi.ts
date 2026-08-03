// frontend/src/features/versions/versionsApi.ts
import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../app/baseQuery';
import type { Version } from './types';

export const versionsApi = createApi({
  reducerPath: 'versionsApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['Version', 'RecordVersions'],
  endpoints: (builder) => ({
    // Get versions for a specific record (timeline)
    getRecordVersions: builder.query<Version[], {
      organizationId: number;
      recordType: string;
      recordId: number;
      limit?: number;
    }>({
      query: ({ organizationId, recordType, recordId, limit = 50 }) => ({
        url: `/organizations/${organizationId}/versions`,
        params: {
          record_type: recordType,
          record_id: recordId,
          limit,
        },
      }),
      providesTags: (result, error, { recordType, recordId }) => [
        { type: 'RecordVersions' as const, id: `${recordType}-${recordId}` },
        ...(result
          ? result.map(({ id }) => ({ type: 'Version' as const, id }))
          : []),
      ],
    }),

    // Get deleted records
    getDeletedRecords: builder.query<Version[], {
      organizationId: number;
      modelType?: string;
      limit?: number;
    }>({
      query: ({ organizationId, modelType, limit = 100 }) => ({
        url: `/organizations/${organizationId}/versions`,
        params: {
          deleted: true,
          model_type: modelType,
          limit,
        },
      }),
      providesTags: [{ type: 'Version', id: 'DELETED' }],
    }),
  }),
});

export const {
  useGetRecordVersionsQuery,
  useGetDeletedRecordsQuery,
} = versionsApi;