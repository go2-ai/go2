// frontend/src/features/roles/rolesApi.ts
import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../app/baseQuery';

export interface Role {
  id: number;
  name: string;
  description: string | null;
  active: boolean;
  department: {
    id: number;
    name: string;
    abbreviation: string;
  } | null;
  parent_id: number | null;
  member: {
    id: number;
    name: string;
  } | null;
  t?: {
    name?: Record<string, string>;
    description?: Record<string, string>;
  };
}

export interface CreateRolePayload {
  name_en?: string;
  name_fa?: string;
  description_en?: string;
  description_fa?: string;
  parent_id?: number | null;
  department_id?: number | null;
  member_id?: number | null;
}

export interface UpdateRolePayload extends Partial<CreateRolePayload> {
  active?: boolean;
}

export const rolesApi = createApi({
  reducerPath: 'rolesApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['Role'],
  endpoints: (builder) => ({
    // GET /organizations/:organizationId/roles
    getRoles: builder.query<Role[], string>({
      query: (organizationId) => ({
        url: `/organizations/${organizationId}/roles`,
        method: 'GET',
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Role' as const, id })),
              { type: 'Role', id: 'LIST' },
            ]
          : [{ type: 'Role', id: 'LIST' }],
    }),

    // GET /organizations/:organizationId/roles/:id
    getRole: builder.query<Role, { organizationId: string; id: number }>({
      query: ({ organizationId, id }) => ({
        url: `/organizations/${organizationId}/roles/${id}`,
        method: 'GET',
      }),
      providesTags: (result, error, { id }) => [{ type: 'Role', id }],
    }),

    // POST /organizations/:organizationId/roles
    createRole: builder.mutation<
      Role,
      { organizationId: string; data: CreateRolePayload }
    >({
      query: ({ organizationId, data }) => ({
        url: `/organizations/${organizationId}/roles`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'Role', id: 'LIST' }],
    }),

    // PATCH /organizations/:organizationId/roles/:id
    updateRole: builder.mutation<
      Role,
      { organizationId: string; id: number; data: UpdateRolePayload }
    >({
      query: ({ organizationId, id, data }) => ({
        url: `/organizations/${organizationId}/roles/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Role', id },
        { type: 'Role', id: 'LIST' },
      ],
    }),

    // DELETE /organizations/:organizationId/roles/:id
    deleteRole: builder.mutation<
      void,
      { organizationId: string; id: number }
    >({
      query: ({ organizationId, id }) => ({
        url: `/organizations/${organizationId}/roles/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: [{ type: 'Role', id: 'LIST' }],
    }),
  }),
});

// Export hooks
export const {
  useGetRolesQuery,
  useGetRoleQuery,
  useCreateRoleMutation,
  useUpdateRoleMutation,
  useDeleteRoleMutation,
} = rolesApi;