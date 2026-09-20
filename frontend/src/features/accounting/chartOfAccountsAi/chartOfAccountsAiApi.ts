import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../../app/baseQuery';
import type {
  AiChat,
  AcceptProposalResponse,
  PostMessageArgs,
  PostMessageResponse,
} from './types';

/**
 * RTK Query slice for the AI chart-of-accounts chat.
 *
 * The chat is per-member, per-organization, and single-kind for now
 * (chart_of_accounts). All endpoints are nested under
 * /organizations/:organizationId/accounting/chart_of_accounts_ai/chats.
 *
 * Endpoints:
 *   getOrCreateChat  — POST /chats (idempotent: returns the member's open
 *                      chat, or creates a new one if none exists)
 *   getChat          — GET  /chats/:id (used for polling while processing)
 *   postMessage      — POST /chats/:id/messages (returns 202 + user_message_id)
 *   acceptProposal   — POST /chats/:id/accept
 *   abandonChat      — POST /chats/:id/abandon
 *
 * Tag strategy: a single 'ChartOfAccountsAiChat' tag type. Per-chat
 * granularity via { type, id: chatId }, plus a LIST tag for the
 * find-or-create flow. After postMessage we DON'T invalidate — we do an
 * optimistic state update on the cache instead so polling picks up the
 * change immediately without a refetch race.
 */
export const chartOfAccountsAiApi = createApi({
  reducerPath: 'chartOfAccountsAiApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['ChartOfAccountsAiChat'],
  endpoints: (builder) => ({
    getOrCreateChat: builder.mutation<AiChat, { organizationId: number }>({
      query: ({ organizationId }) => ({
        url: `/organizations/${organizationId}/accounting/chart_of_accounts_ai/chats`,
        method: 'POST',
      }),
      invalidatesTags: [{ type: 'ChartOfAccountsAiChat', id: 'LIST' }],
    }),

    getChat: builder.query<AiChat, { organizationId: number; chatId: number }>({
      query: ({ organizationId, chatId }) => ({
        url: `/organizations/${organizationId}/accounting/chart_of_accounts_ai/chats/${chatId}`,
        method: 'GET',
      }),
      providesTags: (result, error, { chatId }) => [
        { type: 'ChartOfAccountsAiChat', id: chatId },
      ],
    }),

    postMessage: builder.mutation<PostMessageResponse, PostMessageArgs>({
      query: ({ organizationId, chatId, content, attachmentIds }) => ({
        url: `/organizations/${organizationId}/accounting/chart_of_accounts_ai/chats/${chatId}/messages`,
        method: 'POST',
        body: {
          content,
          attachment_ids: attachmentIds ?? [],
        },
      }),
      async onQueryStarted(
        { organizationId, chatId },
        { dispatch, queryFulfilled },
      ) {
        // Optimistic: flip processing to true immediately so the UI shows
        // the "thinking..." indicator and polling re-enables even before
        // the request resolves.
        const patch = dispatch(
          chartOfAccountsAiApi.util.updateQueryData(
            'getChat',
            { organizationId, chatId },
            (draft) => {
              draft.state = { ...draft.state, processing: true };
            },
          ),
        );

        try {
          const { data } = await queryFulfilled;

          // MERGE the server's fields in rather than replacing the whole
          // object with Object.assign. The backend now sets
          // state.processing = true synchronously before responding, so
          // this should already agree with the optimistic patch above —
          // but merging (instead of a full overwrite) makes this
          // resilient even if a future change reintroduces a race,
          // rather than silently clobbering `processing` back to false
          // mid-flight.
          dispatch(
            chartOfAccountsAiApi.util.updateQueryData(
              'getChat',
              { organizationId, chatId },
              (draft) => {
                draft.state = { ...draft.state, ...data.chat.state };
                draft.messages = data.chat.messages ?? draft.messages;
                draft.status = data.chat.status;
                draft.last_message_at = data.chat.last_message_at;
                draft.updated_at = data.chat.updated_at;
              },
            ),
          );
        } catch {
          // Failure: roll back the optimistic flag.
          patch.undo();
        }
      },
    }),

    acceptProposal: builder.mutation<
      AcceptProposalResponse,
      { organizationId: number; chatId: number }
    >({
      query: ({ organizationId, chatId }) => ({
        url: `/organizations/${organizationId}/accounting/chart_of_accounts_ai/chats/${chatId}/accept`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, { chatId }) => [
        { type: 'ChartOfAccountsAiChat', id: chatId },
        // After acceptance the chart of accounts itself is stale, so
        // the caller should also invalidate the accounting slices. See
        // README for the list of tags to add here if you want that
        // handled automatically.
      ],
    }),

    abandonChat: builder.mutation<
      AiChat,
      { organizationId: number; chatId: number }
    >({
      query: ({ organizationId, chatId }) => ({
        url: `/organizations/${organizationId}/accounting/chart_of_accounts_ai/chats/${chatId}/abandon`,
        method: 'POST',
      }),
      invalidatesTags: (result, error, { chatId }) => [
        { type: 'ChartOfAccountsAiChat', id: chatId },
        { type: 'ChartOfAccountsAiChat', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetOrCreateChatMutation,
  useGetChatQuery,
  usePostMessageMutation,
  useAcceptProposalMutation,
  useAbandonChatMutation,
} = chartOfAccountsAiApi;