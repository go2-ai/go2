import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../app/baseQuery';

/** Template as returned by the list endpoint (without its content). */
export interface ReportTemplateSummary {
  id: number;
  /** Name in the current language. */
  name: string;
  report_key: string;
  /** Language the template is written in, e.g. 'fa'. */
  locale: string;
  parent_template_id: number | null;
  created_at: string;
  updated_at: string;
  system: boolean;
  created_by_name: string | null;
  t?: {
    name?: Record<string, string>;
  };
  /** The current member may design, rename and delete it (own templates of those who manage the report). */
  editable: boolean;
  /** The current member may create a copy of it (those who manage the report). */
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
}

/** Whose default: the whole organization's, or the current member's own. */
export type ReportDefaultScope = 'organization' | 'personal';

export interface ReportLocaleTemplate {
  /** One of the organization's locales (the primary locale comes first). */
  locale: string;
  /** Template that prints in this locale; null without any system template. */
  template_id: number | null;
  /** Locale of that template: differs from `locale` when it is a fallback. */
  template_locale: string | null;
  /** System template for this locale (falls back to the organization's locale, then English). */
  system_template_id: number | null;
  system_template_locale: string | null;
}

/** Which templates print a report for the current member (resolved by the server). */
export interface ReportResolution {
  report_key: string;
  /** Personal default, else organization default, else the system template in the organization's locale. */
  default_template_id: number | null;
  organization_default_template_id: number | null;
  personal_default_template_id: number | null;
  locales: ReportLocaleTemplate[];
  /** May manage templates and set the organization default. */
  can_manage: boolean;
  /** May print, and set a personal default. */
  can_print: boolean;
}

export const reportTemplatesApi = createApi({
  reducerPath: 'reportTemplatesApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['ReportTemplate', 'ReportResolution'],
  endpoints: (builder) => ({
    getReportTemplates: builder.query<ReportTemplateSummary[], number>({
      query: (organizationId) => `/organizations/${organizationId}/report_templates`,
      providesTags: [{ type: 'ReportTemplate', id: 'LIST' }],
    }),

    getReportTemplate: builder.query<ReportTemplate, { organizationId: number; id: number }>({
      query: ({ organizationId, id }) => `/organizations/${organizationId}/report_templates/${id}`,
      providesTags: (_result, _error, { id }) => [{ type: 'ReportTemplate', id }],
    }),

    /** New templates are always copies of an existing one, in its locale unless another is given. */
    copyReportTemplate: builder.mutation<
      ReportTemplate,
      { organizationId: number; sourceTemplateId: number; name?: Record<string, string>; locale?: string }
    >({
      query: ({ organizationId, sourceTemplateId, name, locale }) => ({
        url: `/organizations/${organizationId}/report_templates`,
        method: 'POST',
        body: { parent_template_id: sourceTemplateId, ...(name ? { name } : {}), ...(locale ? { locale } : {}) },
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
      // Defaults that used the template are deleted with it.
      invalidatesTags: (_result, _error, { id }) => [
        { type: 'ReportTemplate', id },
        { type: 'ReportTemplate', id: 'LIST' },
        { type: 'ReportResolution', id: 'LIST' },
      ],
    }),

    getReportResolution: builder.query<ReportResolution, { organizationId: number; reportKey: string }>({
      query: ({ organizationId, reportKey }) => ({
        url: `/organizations/${organizationId}/report_defaults`,
        params: { report_key: reportKey },
      }),
      providesTags: (_result, _error, { reportKey }) => [
        { type: 'ReportResolution', id: reportKey },
        { type: 'ReportResolution', id: 'LIST' },
      ],
    }),

    setReportDefault: builder.mutation<
      ReportResolution,
      { organizationId: number; reportKey: string; templateId: number; scope: ReportDefaultScope }
    >({
      query: ({ organizationId, reportKey, templateId, scope }) => ({
        url: `/organizations/${organizationId}/report_defaults`,
        method: 'PUT',
        body: { report_key: reportKey, report_template_id: templateId, scope },
      }),
      invalidatesTags: (_result, _error, { reportKey }) => [{ type: 'ReportResolution', id: reportKey }],
    }),

    clearReportDefault: builder.mutation<
      ReportResolution,
      { organizationId: number; reportKey: string; scope: ReportDefaultScope }
    >({
      query: ({ organizationId, reportKey, scope }) => ({
        url: `/organizations/${organizationId}/report_defaults`,
        method: 'DELETE',
        params: { report_key: reportKey, scope },
      }),
      invalidatesTags: (_result, _error, { reportKey }) => [{ type: 'ReportResolution', id: reportKey }],
    }),
  }),
});

export const {
  useGetReportTemplatesQuery,
  useGetReportTemplateQuery,
  useCopyReportTemplateMutation,
  useUpdateReportTemplateMutation,
  useDeleteReportTemplateMutation,
  useGetReportResolutionQuery,
  useSetReportDefaultMutation,
  useClearReportDefaultMutation,
} = reportTemplatesApi;

// Kept here for existing imports; lives in utils/apiErrorMessage.
export { apiErrorMessage } from '../../utils/apiErrorMessage';
