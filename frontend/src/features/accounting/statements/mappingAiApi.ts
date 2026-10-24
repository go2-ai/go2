import { compactParams, reportingApi } from '../../reporting/reportingApi';
import type { AiChat } from '../../ai/types';
import type { InspectionResult, LayoutPayload } from './types';

const base = (organizationId: number, reportId: number) =>
  `/organizations/${organizationId}/accounting/statements/${reportId}/mapping_chats`;

type Ids = { organizationId: number; reportId: number };

export interface MappingChange {
  index?: number;
  action: 'add' | 'update' | 'remove';
  rule_number?: number;
  line_key?: string;
  opposite_line_key?: string;
  selector_type?: string;
  selector?: Record<string, unknown>;
  grain?: string;
  measure?: string;
  center_level?: number;
  center_codes?: string[];
  center_type_names?: string[];
  currencies?: string[];
  priority?: number;
  reason?: string;
  confidence?: number;
}

export interface MappingProposal {
  summary: string;
  changes: MappingChange[];
}

export type MappingPreview = InspectionResult & { changes: MappingChange[] };

export const mappingAiApi = reportingApi.enhanceEndpoints({ addTagTypes: ['MappingChat', 'StatementLayout', 'Inspection'] }).injectEndpoints({
  endpoints: (builder) => ({
    getOrCreateMappingChat: builder.mutation<AiChat, Ids>({
      query: ({ organizationId, reportId }) => ({ url: base(organizationId, reportId), method: 'POST' }),
    }),
    getMappingChat: builder.query<AiChat, Ids & { chatId: number }>({
      query: ({ organizationId, reportId, chatId }) => `${base(organizationId, reportId)}/${chatId}`,
      providesTags: (_r, _e, { chatId }) => [{ type: 'MappingChat', id: chatId }],
    }),
    postMappingMessage: builder.mutation<{ chat: AiChat }, Ids & { chatId: number; content: string; attachmentIds?: number[] }>({
      query: ({ organizationId, reportId, chatId, content, attachmentIds }) => ({
        url: `${base(organizationId, reportId)}/${chatId}/messages`,
        method: 'POST',
        body: { content, attachment_ids: attachmentIds ?? [] },
      }),
      invalidatesTags: (_r, _e, { chatId }) => [{ type: 'MappingChat', id: chatId }],
    }),
    getMappingPreview: builder.query<MappingPreview, Ids & { chatId: number; indexes: number[]; date?: string; from?: string; to?: string }>({
      query: ({ organizationId, reportId, chatId, indexes, ...params }) => ({
        url: `${base(organizationId, reportId)}/${chatId}/preview`,
        params: compactParams({ ...params, indexes: indexes.join(',') }),
      }),
    }),
    acceptMapping: builder.mutation<{ chat: AiChat; applied: number[]; layout: LayoutPayload }, Ids & { chatId: number; indexes: number[] }>({
      query: ({ organizationId, reportId, chatId, indexes }) => ({
        url: `${base(organizationId, reportId)}/${chatId}/accept`,
        method: 'POST',
        body: { indexes },
      }),
      invalidatesTags: (_r, _e, { reportId, chatId }) => [
        { type: 'MappingChat', id: chatId },
        { type: 'StatementLayout', id: reportId },
        { type: 'ReportRun', id: reportId },
        { type: 'ReportRun', id: 'LIST' },
        { type: 'Inspection', id: reportId },
      ],
    }),
    abandonMappingChat: builder.mutation<AiChat, Ids & { chatId: number }>({
      query: ({ organizationId, reportId, chatId }) => ({ url: `${base(organizationId, reportId)}/${chatId}/abandon`, method: 'POST' }),
      invalidatesTags: (_r, _e, { chatId }) => [{ type: 'MappingChat', id: chatId }],
    }),
  }),
});

export const {
  useGetOrCreateMappingChatMutation,
  useGetMappingChatQuery,
  usePostMappingMessageMutation,
  useLazyGetMappingPreviewQuery,
  useAcceptMappingMutation,
  useAbandonMappingChatMutation,
} = mappingAiApi;
