import { Box, Chip, Divider, Stack, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useTranslation } from 'react-i18next';
import type { JournalEntryRow } from './types';
import type { Account } from '../../accounts/accountsApi';
import type { Center } from '../../centers/centersApi';

interface JournalEntryFooterProps {
  row?: JournalEntryRow | null;
  accounts: Account[];
  centers: Center[];
  centerLevels: number;
  totals: { debit: number; credit: number; difference: number; balanced: boolean };
}

export const JournalEntryFooter = ({
  row,
  accounts,
  centers,
  centerLevels,
  totals,
}: JournalEntryFooterProps) => {
  const { t: tJE } = useTranslation('accounting');
  const theme = useTheme();

  const account = row ? (accounts.find(a => a.id === row.accountId) ?? null) : null;
  const accountLabel = account ? `${account.full_code || account.code} | ${account.name}` : null;

  const centerChips: string[] = [];
  for (let i = 1; i <= centerLevels; i++) {
    const centerId = row
      ? (row[`center${i}Id` as keyof JournalEntryRow] as number | null)
      : null;
    const center = centerId ? centers.find(c => c.id === centerId) : null;
    if (center) {
      centerChips.push(`${center.code} | ${center.name}`);
    }
  }

  const totalsBgColor = totals.balanced
    ? alpha(theme.palette.success.main, 0.08)
    : alpha(theme.palette.error.main, 0.08);

  const totalsBorderColor = totals.balanced
    ? alpha(theme.palette.success.main, 0.3)
    : alpha(theme.palette.error.main, 0.3);

  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'stretch',
        px: 2,
        py: 1.5,
        gap: 3,
        flexWrap: 'wrap',
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        minHeight: 64,
      }}
    >
      {/* LEFT: Selection Inspector */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flex: 1,
          minWidth: 0,
        }}
      >
        {row && account && (
          <>
            <Chip
              size="small"
              label={accountLabel}
              color="primary"
              variant="outlined"
              sx={{
                fontFamily: 'monospace',
                fontWeight: 500,
                fontSize: '0.8125rem',
                height: 28,
              }}
            />
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {centerChips.map((line, i) => (
                <Chip
                  key={i}
                  size="small"
                  label={line}
                  variant="outlined"
                  sx={{
                    bgcolor: 'action.hover',
                    fontSize: '0.75rem',
                    fontFamily: 'monospace',
                    height: 28,
                  }}
                />
              ))}
            </Box>
          </>
        )}
      </Box>

      {/* RIGHT: Document Totals Panel */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 2.5,
          py: 1,
          borderRadius: 1,
          border: 1,
          borderColor: totalsBorderColor,
        }}
      >
        <Stack direction="row" spacing={2.5} alignItems="center">
          <Box sx={{ textAlign: 'center' }}>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ mb: 0.25 }}
            >
              {tJE('debitTotal')}
            </Typography>
            <Typography
              variant="body2"
              fontWeight={700}
              color="error.main"
              fontFamily="monospace"
              sx={{ fontSize: '0.875rem' }}
            >
              {totals.debit.toLocaleString()}
            </Typography>
          </Box>

          <Divider orientation="vertical" flexItem sx={{ opacity: 0.4 }} />

          <Box sx={{ textAlign: 'center' }}>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ mb: 0.25 }}
            >
              {tJE('creditTotal')}
            </Typography>
            <Typography
              variant="body2"
              fontWeight={700}
              color="primary.light"
              fontFamily="monospace"
              sx={{ fontSize: '0.875rem' }}
            >
              {totals.credit.toLocaleString()}
            </Typography>
          </Box>

          <Divider orientation="vertical" flexItem sx={{ opacity: 0.4 }} />

          <Box sx={{ textAlign: 'center', minWidth: 90 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              display="block"
              sx={{ mb: 0.25 }}
            >
              {tJE('difference')}
            </Typography>
            <Typography
              variant="body2"
              fontWeight={700}
              fontFamily="monospace"
              color={totals.balanced ? 'success.main' : 'error.main'}
              sx={{ fontSize: '0.875rem' }}
            >
              {totals.balanced ? tJE('balanced') : totals.difference.toLocaleString()}
            </Typography>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
};