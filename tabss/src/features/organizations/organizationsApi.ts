import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithCsrf } from "@/utils/baseQuery";
import type { Organization } from "./types";

export const organizationsApi = createApi({
  reducerPath: "organizationsApi",
  baseQuery: baseQueryWithCsrf,
  tagTypes: ["Organization"],
  endpoints: (builder) => ({
    getMyOrganizations: builder.query<Organization[], void>({
      query: () => "/organizations?my_organizations=true",
      providesTags: ["Organization"],
    }),
    getOrganization: builder.query<Organization, number>({
      query: (id) => `/organizations/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Organization", id }],
    }),
    createTrialOrganization: builder.mutation<Organization, { name: string }>({
      query: (data) => ({
        url: "/organizations",
        method: "POST",
        body: { ...data, is_trial: true },
      }),
      invalidatesTags: ["Organization"],
    }),
  }),
});

export const {
  useGetMyOrganizationsQuery,
  useGetOrganizationQuery,
  useCreateTrialOrganizationMutation,
} = organizationsApi;
