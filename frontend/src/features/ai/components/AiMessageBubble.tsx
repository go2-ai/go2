import React from 'react';
import { Box, Paper, Typography } from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import type { AiMessage } from '../types';

interface AiMessageBubbleProps {
  message: AiMessage;
}

export const AiMessageBubble: React.FC<AiMessageBubbleProps> = ({ message }) => {
  const isUser = message.role === 'user';

  return (
    <Box sx={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          alignItems: 'flex-start',
          maxWidth: '85%',
          flexDirection: isUser ? 'row-reverse' : 'row',
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            bgcolor: isUser ? 'primary.main' : 'action.selected',
            color: isUser ? 'primary.contrastText' : 'text.primary',
          }}
        >
          {isUser ? (
            <PersonIcon sx={{ fontSize: 16 }} />
          ) : (
            <SmartToyIcon sx={{ fontSize: 16 }} />
          )}
        </Box>

        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            bgcolor: isUser ? 'primary.light' : 'action.hover',
            color: isUser ? 'primary.contrastText' : 'text.primary',
            borderRadius: 2,
          }}
        >
          <Typography
            variant="body2"
            sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
          >
            {message.content}
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
};