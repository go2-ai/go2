import React from 'react';
import { Chip, Stack } from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';

export interface PendingAttachment {
  id: number;
  filename: string;
}

interface AiPendingAttachmentChipsProps {
  attachments: PendingAttachment[];
  onRemove: (index: number) => void;
}

export const AiPendingAttachmentChips: React.FC<AiPendingAttachmentChipsProps> = ({
  attachments,
  onRemove,
}) => {
  if (attachments.length === 0) return null;

  return (
    <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
      {attachments.map((attachment, index) => (
        <Chip
          key={`${attachment.id}-${index}`}
          icon={<AttachFileIcon />}
          label={attachment.filename}
          size="small"
          variant="outlined"
          onDelete={() => onRemove(index)}
        />
      ))}
    </Stack>
  );
};