import { Box, Container, Skeleton, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

const PLACEHOLDER_ROWS = 8;

/**
 * Placeholder with the layout of the journal entry editor, shown while the
 * entry, accounts, centers, currencies and settings are loading, so the page
 * shows its shape right away instead of an empty spinner screen.
 */
export const JournalEntryEditorSkeleton = () => {
  const { t } = useTranslation('accounting');
  const { t: tShared } = useTranslation('shared');

  return (
    <Container
      maxWidth={false}
      role="status"
      aria-live="polite"
      aria-label={tShared('components.tabs.loading')}
      sx={{ py: 1, mx: 0, display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 100px)', overflow: 'hidden' }}
    >
      <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4">{t('journalEntry')}</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Skeleton variant="rounded" width={140} height={36} />
          <Skeleton variant="rounded" width={160} height={36} />
          <Skeleton variant="circular" width={36} height={36} />
        </Box>
      </Box>

      <Box sx={{ mb: 1, display: 'flex', gap: 2, alignItems: 'center' }}>
        <Skeleton variant="rounded" width={130} height={40} />
        <Skeleton variant="rounded" width={200} height={40} />
        <Skeleton variant="rounded" sx={{ flex: 1 }} height={40} />
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
        <Skeleton variant="rectangular" height={40} />
        {Array.from({ length: PLACEHOLDER_ROWS }, (_, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1, px: 1, height: 40, alignItems: 'center', borderTop: 1, borderColor: 'divider' }}>
            <Skeleton width={40} />
            <Skeleton width={90} />
            <Skeleton width={90} />
            <Skeleton sx={{ flex: 1 }} />
            <Skeleton width={110} />
            <Skeleton width={110} />
          </Box>
        ))}
      </Box>

      <Typography component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>
        {tShared('components.tabs.loading')}
      </Typography>
    </Container>
  );
};
