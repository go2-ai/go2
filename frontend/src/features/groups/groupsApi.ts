// frontend/src/features/groups/groupsApi.ts
import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../app/baseQuery';

export interface GroupMember {
  id: number;
  name: string;
}

export interface Group {
  id: number;
  name: string;
  description: string | null;
  members: GroupMember[];
  t?: {
    name?: Record<string, string>;
    description?: Record<string, string>;
  };
}

export interface CreateGroupPayload {
  name_en?: string;
  name_fa?: string;
  description_en?: string;
  description_fa?: string;
  member_ids?: number[];
}

export interface UpdateGroupPayload extends Partial<CreateGroupPayload> {}

export const groupsApi = createApi({
  reducerPath: 'groupsApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['Group'],
  endpoints: (builder) => ({
    // GET /organizations/:organizationId/groups
    getGroups: builder.query<Group[], number>({
      query: (organizationId) => `/organizations/${organizationId}/groups`,
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Group' as const, id })),
              { type: 'Group', id: 'LIST' },
            ]
          : [{ type: 'Group', id: 'LIST' }],
    }),

    // GET /organizations/:organizationId/groups/:id
    getGroup: builder.query<Group, { organizationId: number; id: number }>({
      query: ({ organizationId, id }) =>
        `/organizations/${organizationId}/groups/${id}`,
      providesTags: (result, error, { id }) => [{ type: 'Group', id }],
    }),

    // POST /organizations/:organizationId/groups
    createGroup: builder.mutation<
      Group,
      { organizationId: number; data: CreateGroupPayload }
    >({
      query: ({ organizationId, data }) => ({
        url: `/organizations/${organizationId}/groups`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'Group', id: 'LIST' }],
    }),

    // PATCH /organizations/:organizationId/groups/:id
    updateGroup: builder.mutation<
      Group,
      { organizationId: number; id: number; data: UpdateGroupPayload }
    >({
      query: ({ organizationId, id, data }) => ({
        url: `/organizations/${organizationId}/groups/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Group', id },
        { type: 'Group', id: 'LIST' },
      ],
    }),

    // DELETE /organizations/:organizationId/groups/:id
    deleteGroup: builder.mutation<void, { organizationId: number; id: number }>({
      query: ({ organizationId, id }) => ({
        url: `/organizations/${organizationId}/groups/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Group', id: 'LIST' }],
    }),
  }),
});

// Export hooks
export const {
  useGetGroupsQuery,
  useGetGroupQuery,
  useCreateGroupMutation,
  useUpdateGroupMutation,
  useDeleteGroupMutation,
} = groupsApi;