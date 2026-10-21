import { Alert, Box, Typography } from '@mui/material';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ClosingState } from '../fiscalYearClosingApi';
import { formatAmount, useClosingLabels } from '../useClosingLabels';

interface Props {
  state: ClosingState;
}

/** The year is closed: what was done. The posted entries are listed below the step. */
export const FinalizedStep = ({ state }: Props) => {
  const { t: tAccounting } = useTranslation('accounting');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const { mainDigits } = useClosingLabels(orgId);
  const summary = state.summary;
  if (!summary) return null;

  const net = summary.net_result === null ? null : Number(summary.net_result);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Alert severity="success">
        {tAccounting('closing.finalized.closed', {
          name: state.fiscal_year.name,
          at: summary.closed_at ? new Date(summary.closed_at).toLocaleString() : '',
          by: summary.closed_by_name ?? '',
        })}
      </Alert>
      {summary.closing_method && (
        <Typography variant="body2">
          {tAccounting('closing.readiness.method', { method: tAccounting(`closingSettings.methods.${summary.closing_method}`) })}
        </Typography>
      )}
      {net !== null && (
        <Typography variant="body2">
          {tAccounting('closing.tempClosing.netResult')}:{' '}
          {tAccounting(net >= 0 ? 'closing.tempClosing.profit' : 'closing.tempClosing.loss')}{' '}
          {formatAmount(String(Math.abs(net)), mainDigits)}
        </Typography>
      )}
    </Box>
  );
};
