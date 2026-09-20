import React, { useEffect, useRef } from 'react';
import { Box, Stack } from '@mui/material';
import { AiMessageBubble } from './AiMessageBubble';
import { AiThinkingIndicator } from './AiThinkingIndicator';
import type { AiMessage } from '../types';

interface AiMessageListProps {
  messages: AiMessage[];
  processing: boolean;
  thinkingLabel: string;
}

// Tool-role messages are backend-internal (validation errors fed to the
// LLM). Filtered out of the user-facing transcript.
const VISIBLE_ROLES = new Set(['user', 'assistant']);

export const AiMessageList: React.FC<AiMessageListProps> = ({
  messages,
  processing,
  thinkingLabel,
}) => {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const visible = messages.filter((m) => VISIBLE_ROLES.has(m.role));

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [visible.length, processing]);

  return (
    <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: 2, py: 2 }}>
      <Stack spacing={1.5}>
        {visible.map((message) => (
          <AiMessageBubble key={message.id} message={message} />
        ))}
        {processing && <AiThinkingIndicator label={thinkingLabel} />}
      </Stack>
      <div ref={bottomRef} />
    </Box>
  );
};