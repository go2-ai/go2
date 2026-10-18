// src/components/tabs/TabLoadingIndicator.tsx
import { useEffect, useState } from 'react';
import { Box, CircularProgress, LinearProgress, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

/** Delay before showing loading UI, so fast loads don't flicker. */
const SHOW_DELAY_MS = 150;

const useDelayed = (active: boolean) => {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!active) {
      setVisible(false);
      return;
    }
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [active]);
  return visible;
};

/** Thin progress bar shown at the top of a tab's content while it loads. */
export function TabLoadingBar({ loading }: { loading: boolean }) {
  const { t } = useTranslation('shared');
  const visible = useDelayed(loading);
  if (!visible) return null;
  return (
    <LinearProgress
      aria-label={t('components.tabs.loading')}
      sx={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 5, height: 3 }}
    />
  );
}

/** Small spinner shown in a tab's title while it loads. */
export function TabTitleSpinner({ loading }: { loading: boolean }) {
  const visible = useDelayed(loading);
  if (!visible) return null;
  return <CircularProgress size={10} thickness={6} sx={{ flexShrink: 0, mr: 0.5 }} aria-hidden />;
}

/**
 * Full-page placeholder for a page that has nothing to show yet. Also used
 * as the Suspense fallback of tab pages.
 */
export function PageLoading({ label }: { label?: string }) {
  const { t } = useTranslation('shared');
  const visible = useDelayed(true);
  return (
    <Box
      role="status"
      aria-live="polite"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        height: '100%',
        minHeight: 200,
        py: 8,
        // Keep the space (no layout jump) but only show after the delay
        visibility: visible ? 'visible' : 'hidden',
      }}
    >
      <CircularProgress size={32} />
      <Typography variant="body2" color="text.secondary">
        {label ?? t('components.tabs.loading')}
      </Typography>
    </Box>
  );
}
