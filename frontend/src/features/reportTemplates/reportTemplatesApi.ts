import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../app/baseQuery';

export interface ReportTemplate {
  id: number;
  name: string;
  report_key: string;
  template_file: string;
  parent_template_id: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  system: boolean;
  created_by_name: string | null;
  t?: {
    name?: Record<string, string>;
  };
}

export interface ReportTemplatePayload {
  report_key?: string;
  template_file?: string;
  name?: Record<string, string>;
  parent_template_id?: number | null;
  is_default?: boolean;
}

export const reportTemplatesApi = createApi({
  reducerPath: 'reportTemplatesApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['ReportTemplate'],
  endpoints: (builder) => ({
    getReportTemplates: builder.query<ReportTemplate[], number>({
      query: (organizationId) =>
        `/organizations/${organizationId}/report_templates`,
      providesTags: ['ReportTemplate'],
    }),

    getReportTemplate: builder.query<
      ReportTemplate,
      { organizationId: number; id: number }
    >({
      query: ({ organizationId, id }) =>
        `/organizations/${organizationId}/report_templates/${id}`,
      providesTags: (result, error, { id }) => [{ type: 'ReportTemplate', id }],
    }),

    createReportTemplate: builder.mutation<
      ReportTemplate,
      { organizationId: number; data: ReportTemplatePayload }
    >({
      query: ({ organizationId, data }) => ({
        url: `/organizations/${organizationId}/report_templates`,
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['ReportTemplate'],
    }),

    updateReportTemplate: builder.mutation<
      ReportTemplate,
      { organizationId: number; id: number; data: ReportTemplatePayload }
    >({
      query: ({ organizationId, id, data }) => ({
        url: `/organizations/${organizationId}/report_templates/${id}`,
        method: 'PATCH',
        body: data,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'ReportTemplate', id },
        { type: 'ReportTemplate', id: 'LIST' },
      ],
    }),

    deleteReportTemplate: builder.mutation<
      void,
      { organizationId: number; id: number }
    >({
      query: ({ organizationId, id }) => ({
        url: `/organizations/${organizationId}/report_templates/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: ['ReportTemplate'],
    }),
  }),
});

export const {
  useGetReportTemplatesQuery,
  useGetReportTemplateQuery,
  useCreateReportTemplateMutation,
  useUpdateReportTemplateMutation,
  useDeleteReportTemplateMutation,
} = reportTemplatesApi;