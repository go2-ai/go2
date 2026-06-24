import { createApi } from '@reduxjs/toolkit/query/react';
import type { Member, MemberPayload } from './types';
import { baseQueryWithCsrf } from '../../app/baseQuery';

const onMemberQueryStarted = async (
  { organizationId, memberId }: { organizationId: number; memberId: number },
  { dispatch, queryFulfilled }: { 
    dispatch: (action: unknown) => void; 
    queryFulfilled: Promise<{ data: Member }>;
  }
) => {
  const { data: updatedMember } = await queryFulfilled;
  dispatch(
    membersApi.util.updateQueryData('getMembers', organizationId, (draft) => {
      const index = draft.findIndex(m => m.id === memberId);
      if (index !== -1) {
        draft[index] = updatedMember;
      }
    })
  );
};

export const membersApi = createApi({
  reducerPath: 'membersApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['Member'],
  endpoints: (builder) => ({
    getMembers: builder.query<Member[], number>({
      query: (organizationId) => `/organizations/${organizationId}/members`,
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Member' as const, id })), { type: 'Member', id: 'LIST' }]
          : [{ type: 'Member', id: 'LIST' }],
    }),
    
    getMember: builder.query<Member, { organizationId: number; memberId: number }>({
      query: ({ organizationId, memberId }) => `/organizations/${organizationId}/members/${memberId}`,
      providesTags: (result, error, { memberId }) => [{ type: 'Member', id: memberId }],
    }),
    
    createMember: builder.mutation<Member, { organizationId: number; data: MemberPayload }>({
      query: ({ organizationId, data }) => ({
        url: `/organizations/${organizationId}/members`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: [{ type: 'Member', id: 'LIST' }],
    }),
    
    updateMember: builder.mutation<Member, { organizationId: number; memberId: number; data: MemberPayload }>({
      query: ({ organizationId, memberId, data }) => ({
        url: `/organizations/${organizationId}/members/${memberId}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { memberId }) => [{ type: 'Member', id: memberId }, { type: 'Member', id: 'LIST' }],
    }),
    
    archiveMember: builder.mutation<Member, { organizationId: number; memberId: number }>({
      query: ({ organizationId, memberId }) => ({
        url: `/organizations/${organizationId}/members/${memberId}/archive`,
        method: 'PATCH',
      }),
      invalidatesTags: (result, error, { memberId }) => [{ type: 'Member', id: memberId }, { type: 'Member', id: 'LIST' }],
    }),
    
    unarchiveMember: builder.mutation<Member, { organizationId: number; memberId: number }>({
      query: ({ organizationId, memberId }) => ({
        url: `/organizations/${organizationId}/members/${memberId}/unarchive`,
        method: 'PATCH',
      }),
      invalidatesTags: (result, error, { memberId }) => [{ type: 'Member', id: memberId }, { type: 'Member', id: 'LIST' }],
    }),
    
    sendInvitation: builder.mutation<Member, { organizationId: number; memberId: number }>({
      query: ({ organizationId, memberId }) => ({
        url: `/organizations/${organizationId}/members/${memberId}/send_invitation`,
        method: 'POST',
      }),
      onQueryStarted: onMemberQueryStarted,
    }),

    setAsAdmin: builder.mutation<Member, { organizationId: number; memberId: number }>({
      query: ({ organizationId, memberId }) => ({
        url: `/organizations/${organizationId}/members/${memberId}/set_as_admin`,
        method: 'PATCH',
      }),
      onQueryStarted: onMemberQueryStarted,
    }),

    revokeAdmin: builder.mutation<Member, { organizationId: number; memberId: number }>({
      query: ({ organizationId, memberId }) => ({
        url: `/organizations/${organizationId}/members/${memberId}/revoke_admin`,
        method: 'PATCH',
      }),
      onQueryStarted: onMemberQueryStarted,
    }),

    archive: builder.mutation<Member, { organizationId: number; memberId: number }>({
      query: ({ organizationId, memberId }) => ({
        url: `/organizations/${organizationId}/members/${memberId}/archive`,
        method: 'PATCH',
      }),
      onQueryStarted: onMemberQueryStarted,
    }),

    unarchive: builder.mutation<Member, { organizationId: number; memberId: number }>({
      query: ({ organizationId, memberId }) => ({
        url: `/organizations/${organizationId}/members/${memberId}/unarchive`,
        method: 'PATCH',
      }),
      onQueryStarted: onMemberQueryStarted,
    }),

    uninvite: builder.mutation<Member, { organizationId: number; memberId: number }>({
      query: ({ organizationId, memberId }) => ({
        url: `/organizations/${organizationId}/members/${memberId}`,
        method: 'PATCH',
        body: { invitation_key: null, invited_at: null },
      }),
      onQueryStarted: onMemberQueryStarted,
    }),

  }),
});

export const {
  useGetMembersQuery,
  useGetMemberQuery,
  useCreateMemberMutation,
  useUpdateMemberMutation,
  useArchiveMemberMutation,
  useUnarchiveMemberMutation,
  useSendInvitationMutation,
  useSetAsAdminMutation,
  useRevokeAdminMutation,
  useArchiveMutation,
  useUnarchiveMutation,
  useUninviteMutation,
} = membersApi;