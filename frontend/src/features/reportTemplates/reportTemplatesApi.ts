import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../app/baseQuery';

/** Template as returned by the list endpoint (without its content). */
export interface ReportTemplateSummary {
  id: number;
  /** Name in the current language. */
  name: string;
  report_key: string;
  parent_template_id: number | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  system: boolean;
  created_by_name: string | null;
  t?: {
    name?: Record<string, string>;
  };
  /** The current member may change, rename, delete and set it as default (own templates of admins). */
  editable: boolean;
  /** The current member may create a copy of it. */
  copyable: boolean;
}

/** Template with its content: an Ariana Reports template as JSON text. */
export interface ReportTemplate extends ReportTemplateSummary {
  template_file: string;
}

export interface ReportTemplateUpdatePayload {
  template_file?: string;
  /** Translated names to change, e.g. { en: 'Voucher' }; other languages are kept. */
  name?: Record<string, string>;
  is_default?: boolean;
}

/** The organization's default template for a report key, falling back to the system template. */
export const findDefaultTemplate = <T extends ReportTemplateSummary>(
  templates: T[] | undefined,
  reportKey: string
): T | undefined => {
  const forKey = templates?.filter((t) => t.report_key === reportKey) ?? [];
  return forKey.find((t) => !t.system && t.is_default) ?? forKey.find((t) => t.system);
};

export const reportTemplatesApi = createApi({
  reducerPath: 'reportTemplatesApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['ReportTemplate'],
  endpoints: (builder) => ({
    getReportTemplates: builder.query<ReportTemplateSummary[], number>({
      query: (organizationId) => `/organizations/${organizationId}/report_templates`,
      providesTags: [{ type: 'ReportTemplate', id: 'LIST' }],
    }),

    getReportTemplate: builder.query<ReportTemplate, { organizationId: number; id: number }>({
      query: ({ organizationId, id }) => `/organizations/${organizationId}/report_templates/${id}`,
      providesTags: (_result, _error, { id }) => [{ type: 'ReportTemplate', id }],
    }),

    /** New templates are always copies of an existing one. */
    copyReportTemplate: builder.mutation<
      ReportTemplate,
      { organizationId: number; sourceTemplateId: number; name?: Record<string, string> }
    >({
      query: ({ organizationId, sourceTemplateId, name }) => ({
        url: `/organizations/${organizationId}/report_templates`,
        method: 'POST',
        body: { parent_template_id: sourceTemplateId, ...(name ? { name } : {}) },
      }),
      invalidatesTags: [{ type: 'ReportTemplate', id: 'LIST' }],
    }),

    updateReportTemplate: builder.mutation<
      ReportTemplate,
      { organizationId: number; id: number; data: ReportTemplateUpdatePayload }
    >({
      query: ({ organizationId, id, data }) => ({
        url: `/organizations/${organizationId}/report_templates/${id}`,
        method: 'PATCH',
        body: data,
      }),
      // Changing the default also clears it on other templates, so refresh the list.
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'ReportTemplate', id },
        { type: 'ReportTemplate', id: 'LIST' },
      ],
    }),

    deleteReportTemplate: builder.mutation<void, { organizationId: number; id: number }>({
      query: ({ organizationId, id }) => ({
        url: `/organizations/${organizationId}/report_templates/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'ReportTemplate', id },
        { type: 'ReportTemplate', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetReportTemplatesQuery,
  useGetReportTemplateQuery,
  useCopyReportTemplateMutation,
  useUpdateReportTemplateMutation,
  useDeleteReportTemplateMutation,
} = reportTemplatesApi;

// Kept here for existing imports; lives in utils/apiErrorMessage.
export { apiErrorMessage } from '../../utils/apiErrorMessage';
