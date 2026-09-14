import { useState } from 'react';
import { useUploadDocumentMutation } from '../documentsApi';
import type { Document } from '../documentsApi';
import { useToast } from '../../../contexts/ToastContext';
import { useTranslation } from 'react-i18next';

interface UseDocumentUploadArgs {
  organizationId: number;
  documentableType: string;
  documentableId: number;
  /**
   * Optional callback fired once per successfully uploaded file, with the
   * created Document. Useful for callers that need to capture the IDs of
   * freshly-uploaded documents (e.g. the AI chat panel stashes them until
   * the user sends a message).
   *
   * Errors from individual uploads are already surfaced via toast — the
   * callback is NOT called for failures.
   */
  onUploaded?: (document: Document) => void;
}

export const useDocumentUpload = ({
  organizationId,
  documentableType,
  documentableId,
  onUploaded,
}: UseDocumentUploadArgs) => {
  const [uploadDocument] = useUploadDocumentMutation();
  const [uploading, setUploading] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<Document[]>([]);
  const { showError } = useToast();
  const { t } = useTranslation('documents');

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploading(true);
    const uploaded: Document[] = [];

    try {
      for (const file of fileArray) {
        try {
          const document = await uploadDocument({
            organizationId,
            documentableType,
            documentableId,
            file,
          }).unwrap();

          uploaded.push(document);
          onUploaded?.(document);
        } catch (err: any) {
          const backendErrors = err?.data?.errors;
          if (backendErrors && backendErrors.length > 0) {
            showError(backendErrors[0]);
          } else {
            showError(t('uploadFailed'));
          }
          // Continue with other files even if one fails
        }
      }
    } finally {
      setUploading(false);
    }

    setUploadedDocuments((prev) => [...prev, ...uploaded]);
    return uploaded;
  };

  return { uploadFiles, uploading, uploadedDocuments };
};