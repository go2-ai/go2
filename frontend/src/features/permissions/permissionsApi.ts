import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../app/baseQuery';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GrantablePermission {
  code: string;
  name: string;
  abilities: string[];
  tags: string[];
}

export interface Permission {
  id: number;
  code: string;
  grantee_type: 'Member' | 'Role' | 'Department' | 'Group';
  grantee_id: number;
  grantee_name: string;
  organization_id: number;
  created_at: string;
  updated_at: string;
}

export interface GrantPermissionRequest {
  code: string;
  grantee_type: 'Member' | 'Role' | 'Department' | 'Group';
  grantee_id: number;
}

// ─── API Client ─────────────────────────────────────────────────────────────

export const permissionsApi = createApi({
  reducerPath: 'permissionsApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['Permission', 'GrantablePermission'],
  endpoints: (builder) => ({
    // GET /organizations/:organizationId/permissions/grantable
    getGrantablePermissions: builder.query<GrantablePermission[], number>({
      query: (organizationId) => ({
        url: `/organizations/${organizationId}/permissions/grantable`,
        method: 'GET',
      }),
      providesTags: [{ type: 'GrantablePermission', id: 'LIST' }],
    }),

    // GET /organizations/:organizationId/permissions
    // Optional filters: code, member_id, include_indirect
    getPermissions: builder.query<
      Permission[],
      {
        organizationId: number;
        code?: string;
        memberId?: number;
        includeIndirect?: boolean;
      }
    >({
      query: ({ organizationId, code, memberId, includeIndirect }) => {
        const params = new URLSearchParams();
        if (code) params.append('code', code);
        if (memberId !== undefined) params.append('member_id', String(memberId));
        if (includeIndirect !== undefined) params.append('include_indirect', String(includeIndirect));

        const url = `/organizations/${organizationId}/permissions${
          params.toString() ? `?${params.toString()}` : ''
        }`;
        return { url, method: 'GET' };
      },
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Permission' as const, id })),
              { type: 'Permission', id: 'LIST' },
            ]
          : [{ type: 'Permission', id: 'LIST' }],
    }),

    // POST /organizations/:organizationId/permissions
    grantPermission: builder.mutation<
      Permission,
      { organizationId: number; data: GrantPermissionRequest }
    >({
      query: ({ organizationId, data }) => ({
        url: `/organizations/${organizationId}/permissions`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [
        { type: 'Permission', id: 'LIST' },
        { type: 'GrantablePermission', id: 'LIST' },
      ],
    }),

    // DELETE /organizations/:organizationId/permissions/:id
    revokePermission: builder.mutation<
      Permission,
      { organizationId: number; id: number }
    >({
      query: ({ organizationId, id }) => ({
        url: `/organizations/${organizationId}/permissions/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Permission', id },
        { type: 'Permission', id: 'LIST' },
        { type: 'GrantablePermission', id: 'LIST' },
      ],
    }),
  }),
});

// ─── Hooks ──────────────────────────────────────────────────────────────────

export const {
  useGetGrantablePermissionsQuery,
  useGetPermissionsQuery,
  useGrantPermissionMutation,
  useRevokePermissionMutation,
} = permissionsApi;