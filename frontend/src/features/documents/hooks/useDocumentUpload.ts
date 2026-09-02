import { useState } from 'react';
import { useUploadDocumentMutation } from '../documentsApi';

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

  const uploadFiles = async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setUploading(true);
    try {
      for (const file of fileArray) {
        await uploadDocument({
          organizationId,
          documentableType,
          documentableId,
          file,
        }).unwrap();
      }
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
    }
  };

  return { uploadFiles, uploading };
};