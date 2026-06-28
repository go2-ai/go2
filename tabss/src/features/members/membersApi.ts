import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithCsrf } from "@/utils/baseQuery";
import type { Member, CreateMemberRequest, UpdateMemberRequest } from "./types";

export const membersApi = createApi({
  reducerPath: "membersApi",
  baseQuery: baseQueryWithCsrf,
  tagTypes: ["Member"],
  endpoints: (builder) => ({
    getMembers: builder.query<Member[], string>({
      query: (orgId) => `/organizations/${orgId}/members`,
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: "Member" as const, id })),
              { type: "Member", id: "LIST" },
            ]
          : [{ type: "Member", id: "LIST" }],
    }),

    getMember: builder.query<Member, { orgId: string; memberId: string }>({
      query: ({ orgId, memberId }) =>
        `/organizations/${orgId}/members/${memberId}`,
      providesTags: (_result, _err, { memberId }) => [
        { type: "Member", id: memberId },
      ],
    }),

    createMember: builder.mutation<
      Member,
      { orgId: string; data: CreateMemberRequest }
    >({
      query: ({ orgId, data }) => ({
        url: `/organizations/${orgId}/members`,
        method: "POST",
        body: { member: data },
      }),
      invalidatesTags: [{ type: "Member", id: "LIST" }],
    }),

    updateMember: builder.mutation<
      Member,
      { orgId: string; memberId: string; data: UpdateMemberRequest }
    >({
      query: ({ orgId, memberId, data }) => ({
        url: `/organizations/${orgId}/members/${memberId}`,
        method: "PATCH",
        body: { member: data },
      }),
      invalidatesTags: (_result, _err, { memberId }) => [
        { type: "Member", id: memberId },
      ],
    }),

    sendInvitation: builder.mutation<void, { orgId: string; memberId: string }>(
      {
        query: ({ orgId, memberId }) => ({
          url: `/organizations/${orgId}/members/${memberId}/send_invitation`,
          method: "POST",
        }),
        invalidatesTags: (_result, _err, { memberId }) => [
          { type: "Member", id: memberId },
        ],
      },
    ),

    archiveMember: builder.mutation<
      Member,
      { orgId: string; memberId: string }
    >({
      query: ({ orgId, memberId }) => ({
        url: `/organizations/${orgId}/members/${memberId}/archive`,
        method: "PATCH",
      }),
      invalidatesTags: (_result, _err, { memberId }) => [
        { type: "Member", id: memberId },
        { type: "Member", id: "LIST" },
      ],
    }),

    unarchiveMember: builder.mutation<
      Member,
      { orgId: string; memberId: string }
    >({
      query: ({ orgId, memberId }) => ({
        url: `/organizations/${orgId}/members/${memberId}/unarchive`,
        method: "PATCH",
      }),
      invalidatesTags: (_result, _err, { memberId }) => [
        { type: "Member", id: memberId },
        { type: "Member", id: "LIST" },
      ],
    }),

    uninviteMember: builder.mutation<
      Member,
      { orgId: string; memberId: string }
    >({
      query: ({ orgId, memberId }) => ({
        url: `/organizations/${orgId}/members/${memberId}/uninvite`,
        method: "PATCH",
      }),
      invalidatesTags: (_result, _err, { memberId }) => [
        { type: "Member", id: memberId },
      ],
    }),

    setAsAdmin: builder.mutation<Member, { orgId: string; memberId: string }>({
      query: ({ orgId, memberId }) => ({
        url: `/organizations/${orgId}/members/${memberId}/set_as_admin`,
        method: "PATCH",
      }),
      invalidatesTags: (_result, _err, { memberId }) => [
        { type: "Member", id: memberId },
      ],
    }),

    revokeAdmin: builder.mutation<Member, { orgId: string; memberId: string }>({
      query: ({ orgId, memberId }) => ({
        url: `/organizations/${orgId}/members/${memberId}/revoke_admin`,
        method: "PATCH",
      }),
      invalidatesTags: (_result, _err, { memberId }) => [
        { type: "Member", id: memberId },
      ],
    }),
  }),
});

export const {
  useGetMembersQuery,
  useGetMemberQuery,
  useCreateMemberMutation,
  useUpdateMemberMutation,
  useSendInvitationMutation,
  useArchiveMemberMutation,
  useUnarchiveMemberMutation,
  useUninviteMemberMutation,
  useSetAsAdminMutation,
  useRevokeAdminMutation,
} = membersApi;
