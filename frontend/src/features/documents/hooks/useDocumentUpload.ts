import { useState } from 'react';
import { useUploadDocumentMutation } from '../documentsApi';
import { useToast } from '../../../contexts/ToastContext';
import { useTranslation } from 'react-i18next';

interface UseDocumentUploadArgs {
  organizationId: number;
  documentableType: string;
  documentableId: number;
}

export const useDocumentUpload = ({
  organizationId,
  documentableType,
  documentableId,
}: UseDocumentUploadArgs) => {
  const [uploadDocument] = useUploadDocumentMutation();
  const [uploading, setUploading] = useState(false);
  const { showError } = useToast();
  const { t } = useTranslation('documents');

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploading(true);
    try {
      for (const file of fileArray) {
        try {
          await uploadDocument({
            organizationId,
            documentableType,
            documentableId,
            file,
          }).unwrap();
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
  };

  return { uploadFiles, uploading };
};