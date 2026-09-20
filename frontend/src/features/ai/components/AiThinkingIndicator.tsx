import React from 'react';
import { Box, CircularProgress, Typography } from '@mui/material';

interface AiThinkingIndicatorProps {
  label: string;
}

export const AiThinkingIndicator: React.FC<AiThinkingIndicatorProps> = ({ label }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 5 }}>
    <CircularProgress size={14} />
    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
      {label}
    </Typography>
  </Box>
);