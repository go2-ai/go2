import React, { useRef, useState } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Tooltip,
  CircularProgress,
  Stack,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import { AiPendingAttachmentChips, type PendingAttachment } from './AiPendingAttachmentChips';

interface AiMessageInputProps {
  /** When true, disables everything and blocks sending. */
  disabled: boolean;
  /** Labels — the caller supplies translated strings. */
  placeholder: string;
  sendTooltip: string;
  attachTooltip: string;

  /** Send handler. Receives the raw text and any pending attachment ids. */
  onSend: (content: string, attachmentIds: number[]) => Promise<void>;

  /**
   * Optional file uploader. When omitted the attach button is hidden.
   * The generic input doesn't know how files are uploaded — the caller
   * passes a function that opens a file picker and fires the callback
   * per uploaded file.
   */
  onPickFiles?: () => void;
  uploading?: boolean;

  /** Current pending attachments (owned by the caller). */
  attachments: PendingAttachment[];
  onRemoveAttachment: (index: number) => void;
}

export const AiMessageInput: React.FC<AiMessageInputProps> = ({
  disabled,
  placeholder,
  sendTooltip,
  attachTooltip,
  onSend,
  onPickFiles,
  uploading = false,
  attachments,
  onRemoveAttachment,
}) => {
  const [value, setValue] = useState('');
  const sendingRef = useRef(false);
  const [sending, setSending] = useState(false);


  const handleSend = async () => {
    const content = value.trim();
    if (!content || disabled || sendingRef.current) return;

    sendingRef.current = true;
    setSending(true);
    try {
      await onSend(content, attachments.map((a) => a.id));
      setValue('');
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Enter sends; Shift+Enter inserts a newline.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const isDisabled = disabled || sending;

  return (
    <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
      {attachments.length > 0 && (
        <Box sx={{ mb: 1 }}>
          <AiPendingAttachmentChips
            attachments={attachments}
            onRemove={onRemoveAttachment}
          />
        </Box>
      )}

      <Stack direction="row" spacing={1} alignItems="flex-end">
        {onPickFiles && (
          <Tooltip title={attachTooltip}>
            <span>
              <IconButton
                onClick={onPickFiles}
                disabled={isDisabled || uploading}
                size="small"
              >
                {uploading ? (
                  <CircularProgress size={18} />
                ) : (
                  <AttachFileIcon fontSize="small" />
                )}
              </IconButton>
            </span>
          </Tooltip>
        )}

        <TextField
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          multiline
          maxRows={6}
          fullWidth
          size="small"
          disabled={isDisabled}
        />

        <Tooltip title={sendTooltip}>
          <span>
            <IconButton
              onClick={handleSend}
              disabled={isDisabled || !value.trim()}
              color="primary"
              size="small"
            >
              {sending ? (
                <CircularProgress size={18} />
              ) : (
                <SendIcon fontSize="small" />
              )}
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  );
};