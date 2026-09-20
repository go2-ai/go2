import React from 'react';
import { Box, Typography } from '@mui/material';
import { AiMessageList } from './AiMessageList';
import { AiMessageInput } from './AiMessageInput';
import { AiActionBanner } from './AiActionBanner';
import type {
  AiActionBannerConfig,
  AiMessage,
} from '../types';
import type { PendingAttachment } from './AiPendingAttachmentChips';

interface AiChatPanelProps {
  messages: AiMessage[];
  processing: boolean;
  emptyStateLabel: string;
  thinkingLabel: string;

  // Input area
  inputDisabled: boolean;
  inputPlaceholder: string;
  sendTooltip: string;
  attachTooltip?: string;
  onSend: (content: string, attachmentIds: number[]) => Promise<void>;
  onPickFiles?: () => void;
  uploading?: boolean;
  attachments: PendingAttachment[];
  onRemoveAttachment: (index: number) => void;

  // Optional banner (rendered above the input)
  banner?: AiActionBannerConfig | null;

  // Optional footer shown instead of the input when the chat is closed
  closedFooter?: string;
}

export const AiChatPanel: React.FC<AiChatPanelProps> = ({
  messages,
  processing,
  emptyStateLabel,
  thinkingLabel,
  inputDisabled,
  inputPlaceholder,
  sendTooltip,
  attachTooltip,
  onSend,
  onPickFiles,
  uploading,
  attachments,
  onRemoveAttachment,
  banner,
  closedFooter,
}) => {
  const showEmpty = messages.length === 0 && !processing;

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.default',
      }}
    >
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {showEmpty && (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {emptyStateLabel}
            </Typography>
          </Box>
        )}

        <AiMessageList
          messages={messages}
          processing={processing}
          thinkingLabel={thinkingLabel}
        />
      </Box>

      {banner && <AiActionBanner config={banner} />}

      {closedFooter ? (
        <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'action.hover' }}>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            {closedFooter}
          </Typography>
        </Box>
      ) : (
        <AiMessageInput
          disabled={inputDisabled}
          placeholder={inputPlaceholder}
          sendTooltip={sendTooltip}
          attachTooltip={attachTooltip ?? ''}
          onSend={onSend}
          onPickFiles={onPickFiles}
          uploading={uploading}
          attachments={attachments}
          onRemoveAttachment={onRemoveAttachment}
        />
      )}
    </Box>
  );
};