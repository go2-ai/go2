import { useRef } from 'react';
import { Button, Box, LinearProgress } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useTranslation } from 'react-i18next';
import { useDocumentUpload } from '../hooks/useDocumentUpload';

interface DocumentUploaderProps {
  organizationId: number;
  documentableType: string;
  documentableId: number;
}

const ACCEPTED_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/json',
];

export const DocumentUploader = ({
  organizationId,
  documentableType,
  documentableId,
}: DocumentUploaderProps) => {
  const { t } = useTranslation('documents');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { uploadFiles, uploading } = useDocumentUpload({
    organizationId,
    documentableType,
    documentableId,
  });

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      await uploadFiles(event.target.files);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <Box>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ACCEPTED_TYPES.join(',')}
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <Button
        variant="contained"
        disableElevation
        startIcon={<UploadFileIcon />}
        size="small"
        disabled={uploading}
        onClick={() => fileInputRef.current?.click()}
      >
        {uploading ? t('uploading') : t('uploadFiles')}
      </Button>
      {uploading && <LinearProgress sx={{ mt: 0.5, borderRadius: 1, width: 140 }} />}
    </Box>
  );
};