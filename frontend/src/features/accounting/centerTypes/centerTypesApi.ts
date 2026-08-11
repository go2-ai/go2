import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../../app/baseQuery';

export interface CenterTypeMetadata {
  id: string;
  name: Record<string, string>;
  type: string;
  required: boolean;
  [key: string]: any; // Dynamic additional fields (max_length, min, max, etc.)
}

export interface CenterType {
  id: number;
  first_code: string;
  last_code: string;
  auto_increment: boolean;
  metadata: CenterTypeMetadata[];
  name: string;
  centers_count: number,
  t?: {
    name?: Record<string, string>;
  };
}

export const accountingCenterTypesApi = createApi({
  reducerPath: 'accountingCenterTypesApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['AccountingCenterType'],
  endpoints: (builder) => ({
    getCenterTypes: builder.query<CenterType[], number>({
      query: (organizationId) =>
        `/organizations/${organizationId}/accounting/center_types`,
      providesTags: ['AccountingCenterType'],
    }),

    createCenterType: builder.mutation<
      CenterType,
      { organizationId: number; data: Record<string, any> }
    >({
      query: ({ organizationId, data }) => ({
        url: `/organizations/${organizationId}/accounting/center_types`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['AccountingCenterType'],
    }),

    updateCenterType: builder.mutation<
      CenterType,
      { organizationId: number; id: number; data: Record<string, any> }
    >({
      query: ({ organizationId, id, data }) => ({
        url: `/organizations/${organizationId}/accounting/center_types/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: ['AccountingCenterType'],
    }),

    deleteCenterType: builder.mutation<
      void,
      { organizationId: number; id: number }
    >({
      query: ({ organizationId, id }) => ({
        url: `/organizations/${organizationId}/accounting/center_types/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['AccountingCenterType'],
    }),
  }),
});

export const {
  useGetCenterTypesQuery,
  useCreateCenterTypeMutation,
  useUpdateCenterTypeMutation,
  useDeleteCenterTypeMutation,
} = accountingCenterTypesApi;