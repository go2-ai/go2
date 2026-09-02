import { createApi } from '@reduxjs/toolkit/query/react';
import { baseQueryWithCsrf } from '../../app/baseQuery';

export interface Document {
  id: number;
  documentable_type: string;
  documentable_id: number;
  created_at: string;
  name: string;
  size: number;
  content_type: string;
  uploaded_by: string | null;
  previewable: boolean;
  url: string;
}

export interface DocumentsQueryArgs {
  organizationId: number;
  documentableType: string;
  documentableId: number;
}

export interface UploadDocumentArgs {
  organizationId: number;
  documentableType: string;
  documentableId: number;
  file: File;
}

export const documentsApi = createApi({
  reducerPath: 'documentsApi',
  baseQuery: baseQueryWithCsrf,
  tagTypes: ['Document'],
  endpoints: (builder) => ({
    getDocuments: builder.query<Document[], DocumentsQueryArgs>({
      query: ({ organizationId, documentableType, documentableId }) => ({
        url: `/organizations/${organizationId}/documents`,
        method: 'GET',
        params: {
          documentable_type: documentableType,
          documentable_id: documentableId,
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Document' as const, id })),
              { type: 'Document', id: 'LIST' },
            ]
          : [{ type: 'Document', id: 'LIST' }],
    }),

    uploadDocument: builder.mutation<Document, UploadDocumentArgs>({
      query: ({ organizationId, documentableType, documentableId, file }) => {
        const formData = new FormData();
        formData.append('documentable_type', documentableType);
        formData.append('documentable_id', String(documentableId));
        formData.append('attachment', file);

        return {
          url: `/organizations/${organizationId}/documents`,
          method: 'POST',
          body: formData,
        };
      },
      invalidatesTags: [{ type: 'Document', id: 'LIST' }],
    }),

    deleteDocument: builder.mutation<
      Document,
      { organizationId: number; id: number }
    >({
      query: ({ organizationId, id }) => ({
        url: `/organizations/${organizationId}/documents/${id}`,
        method: 'DELETE',
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: 'Document', id },
        { type: 'Document', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetDocumentsQuery,
  useUploadDocumentMutation,
  useDeleteDocumentMutation,
} = documentsApi;