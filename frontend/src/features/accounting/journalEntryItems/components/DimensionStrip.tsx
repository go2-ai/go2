// journalEntryItems/DimensionStrip.tsx
import { Box, alpha } from '@mui/material';
import type { ReactNode } from 'react';

export const DimensionStripContainer = ({ children }: { children: ReactNode }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'flex-start',
      flexWrap: 'wrap',
      gap: 1,
      py: 1.25,
      px: 1.5,
      mb: 2,
      borderRadius: 2,
      bgcolor: (theme) => alpha(theme.palette.text.primary, 0.025),
      border: (theme) => `1px solid ${theme.palette.divider}`,
    }}
  >
    {children}
  </Box>
);

// A single text pill. `onClick` makes it interactive (DrillTrail);
// omit it for a static pill (AppliedFilters' dimension label, or the current step).
interface DimensionPillProps {
  label: string;
  onClick?: () => void;
  variant?: 'default' | 'current';
}

export const DimensionPill = ({ label, onClick, variant = 'default' }: DimensionPillProps) => (
  <Box
    component={onClick ? 'button' : 'div'}
    onClick={onClick}
    sx={{
      display: 'flex',
      alignItems: 'center',
      border: 'none',
      cursor: onClick ? 'pointer' : 'default',
      bgcolor: variant === 'current' ? (theme) => alpha(theme.palette.primary.main, 0.12) : 'transparent',
      borderRadius: 5,
      px: 1,
      py: 0.5,
      color: variant === 'current' ? 'primary.main' : 'text.secondary',
      boxShadow: variant === 'current' ? (theme) => `0 0 0 1px ${alpha(theme.palette.primary.main, 0.3)}` : 'none',
      transition: 'background-color 0.15s ease, color 0.15s ease',
      ...(onClick && {
        '&:hover': { bgcolor: (theme) => alpha(theme.palette.primary.main, 0.08), color: 'primary.main' },
      }),
    }}
  >
    <Box component="span" sx={{ fontSize: 12, fontWeight: variant === 'current' ? 700 : 600, whiteSpace: 'nowrap' }}>
      {label}
    </Box>
  </Box>
);