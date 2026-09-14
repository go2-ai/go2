import React, { useState } from 'react';
import { Box, Paper, Typography, Button, Stack } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import type { AiActionBannerConfig } from '../types';

interface AiActionBannerProps {
  config: AiActionBannerConfig;
}

const SEVERITY_COLORS = {
  info: 'info.main',
  success: 'success.main',
  warning: 'warning.main',
  error: 'error.main',
} as const;

export const AiActionBanner: React.FC<AiActionBannerProps> = ({ config }) => {
  const theme = useTheme();
  const [busyIndex, setBusyIndex] = useState<number | null>(null);

  const severity = config.severity ?? 'info';
  const borderColor = SEVERITY_COLORS[severity];

  const handleActionClick = async (index: number) => {
    const action = config.actions?.[index];
    if (!action) return;

    setBusyIndex(index);
    try {
      await action.onClick();
    } finally {
      setBusyIndex(null);
    }
  };

  return (
    <Box sx={{ px: 2, pt: 1.5 }}>
      <Paper
        elevation={0}
        sx={{
          p: 1.5,
          border: 1,
          borderColor,
          bgcolor: alpha(theme.palette[severity].main, theme.palette.mode === 'dark' ? 0.08 : 0.06),
          borderRadius: 1,
        }}
      >
        <Stack direction="row" spacing={1} alignItems="flex-start">
          {config.icon && <Box sx={{ mt: 0.25 }}>{config.icon}</Box>}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600}>
              {config.title}
            </Typography>
            {config.message && (
              <Typography variant="caption" color="text.secondary" display="block">
                {config.message}
              </Typography>
            )}

            {config.actions && config.actions.length > 0 && (
              <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
                {config.actions.map((action, index) => (
                  <Button
                    key={index}
                    size="small"
                    variant={action.variant ?? 'contained'}
                    color={action.color ?? 'primary'}
                    onClick={() => handleActionClick(index)}
                    disabled={action.disabled || busyIndex !== null}
                  >
                    {busyIndex === index ? '…' : action.label}
                  </Button>
                ))}
              </Stack>
            )}
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
};