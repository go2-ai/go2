import { createApi } from '@reduxjs/toolkit/query/react';
import type { Organization } from './types';
import { baseQueryWithCsrf } from '../../app/baseQuery';

export const organizationsApi = createApi({
  reducerPath: 'organizationsApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['Organization'],
  endpoints: (builder) => ({
    getMyOrganizations: builder.query<Organization[], void>({
      query: () => '/organizations?my_organizations=true',
    }),
    getOrganization: builder.query<Organization, number>({
      query: (organizationId) => `/organizations/${organizationId}`,
      providesTags: (result, error, id) => [{ type: 'Organization', id }],
    }),
    createTrialOrganization: builder.mutation<Organization, { name: string }>({
      query: (data) => ({
        url: '/organizations',
        method: 'POST',
        body: { ...data, is_trial: true },
      }),
    }),
    updateOrganization: builder.mutation<
      Organization,
      { id: number; data: Record<string, any> }
    >({
      query: ({ id, data }) => ({
        url: `/organizations/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: 'Organization', id }],
    }),
  }),
});

export const {
  useGetMyOrganizationsQuery,
  useGetOrganizationQuery,
  useCreateTrialOrganizationMutation,
  useUpdateOrganizationMutation,
} = organizationsApi;