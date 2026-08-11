import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../../app/baseQuery';

export interface CenterTypeInfo {
  id: number;
  first_code: string;
  last_code: string;
  auto_increment: boolean;
  name: string;
  metadata?: Array<{
    id: string;
    name: Record<string, string>;
    type: string;
    required: boolean;
  }>;
  t?: {
    name?: Record<string, string>;
  };
}

export interface Center {
  id: number;
  code: string;
  name: string;
  centerable_type: string | null;
  centerable_id: number | null;
  metadata: Record<string, any>;
  center_type: CenterTypeInfo;
  t?: {
    name?: Record<string, string>;
  };
}

export const accountingCentersApi = createApi({
  reducerPath: 'centersApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['Center'],
  endpoints: (builder) => ({
    getCenters: builder.query<Center[], { organizationId: number; centerTypeId?: number }>({
      query: ({ organizationId, centerTypeId }) => {
        const params = new URLSearchParams();
        if (centerTypeId) params.append('center_type_id', String(centerTypeId));
        const qs = params.toString();
        return `/organizations/${organizationId}/accounting/centers${qs ? `?${qs}` : ''}`;
      },
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Center' as const, id })), { type: 'Center', id: 'LIST' }]
          : [{ type: 'Center', id: 'LIST' }],
    }),

    getCenter: builder.query<Center, { organizationId: number; id: number }>({
      query: ({ organizationId, id }) =>
        `/organizations/${organizationId}/accounting/centers/${id}`,
      providesTags: (result, error, { id }) => [{ type: 'Center', id }],
    }),

    createCenter: builder.mutation<Center, { organizationId: number; data: Record<string, any> }>({
      query: ({ organizationId, data }) => ({
        url: `/organizations/${organizationId}/accounting/centers`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'Center', id: 'LIST' }],
    }),

    updateCenter: builder.mutation<Center, { organizationId: number; id: number; data: Record<string, any> }>({
      query: ({ organizationId, id, data }) => ({
        url: `/organizations/${organizationId}/accounting/centers/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Center', id }, { type: 'Center', id: 'LIST' }],
    }),

    deleteCenter: builder.mutation<void, { organizationId: number; id: number }>({
      query: ({ organizationId, id }) => ({
        url: `/organizations/${organizationId}/accounting/centers/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Center', id: 'LIST' }],
    }),
  }),
});

export const {
  useGetCentersQuery,
  useGetCenterQuery,
  useCreateCenterMutation,
  useUpdateCenterMutation,
  useDeleteCenterMutation,
} = accountingCentersApi;