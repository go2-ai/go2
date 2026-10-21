import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { Alert, AlertTitle, Box, Button, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../../contexts/ToastContext';
import { useConfirm } from '../../../../contexts/confirmContext';
import { apiErrorMessage } from '../../../../utils/apiErrorMessage';
import { journalEntriesApi } from '../../journalEntries/journalEntriesApi';
import { fiscalYearClosingApi, usePostEndingMutation, type ClosingState } from '../fiscalYearClosingApi';
import { ClosingLinesTable } from '../components/ClosingLinesTable';
import { ClosingLineDescriptions } from '../components/ClosingLineDescriptions';
import { formatAmount, useClosingLabels } from '../useClosingLabels';

interface Props {
  state: ClosingState;
}

/**
 * Step 4: the ending entry brings every balance sheet (and "other")
 * balance to zero as of the last day; the beginning entry of the next year
 * mirrors it.
 */
export const EndingStep = ({ state }: Props) => {
  const { t: tAccounting } = useTranslation('accounting');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const dispatch = useDispatch();
  const { showSuccess, showError, showWarning } = useToast();
  const confirm = useConfirm();
  const { mainDigits, accountLabel, centersLabel, currencyAbr } = useClosingLabels(orgId);
  const [postEnding, { isLoading: posting }] = usePostEndingMutation();

  const preview = state.ending;
  if (!preview) return null;
  const fiscalYearId = state.fiscal_year.id;

  const handlePost = async () => {
    if (preview.lines.length > 0) {
      const ok = await confirm({
        title: tAccounting('closing.ending.postTitle'),
        message: tAccounting('closing.ending.postMessage', { date: state.fiscal_year.finish_date }),
        confirmText: tAccounting('closing.ending.post'),
        confirmColor: 'primary',
      });
      if (!ok) return;
    }
    try {
      await postEnding({ organizationId: orgId, fiscalYearId, checksum: preview.checksum }).unwrap();
      dispatch(journalEntriesApi.util.invalidateTags(['JournalEntry']));
      showSuccess(tAccounting('closing.ending.posted'));
    } catch (err) {
      if ((err as { status?: number })?.status === 409) {
        dispatch(fiscalYearClosingApi.util.invalidateTags([{ type: 'FiscalYearClosing', id: fiscalYearId }]));
        showWarning(apiErrorMessage(err) || tAccounting('closing.actionFailed'));
      } else {
        showError(apiErrorMessage(err) || tAccounting('closing.actionFailed'));
      }
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {tAccounting('closing.ending.intro', { date: state.fiscal_year.finish_date })}
      </Typography>

      {preview.open_temporary.length > 0 && (
        <Alert severity="error">
          <AlertTitle>{tAccounting('closing.ending.openTemporaryTitle', { count: preview.open_temporary.length })}</AlertTitle>
          <Typography variant="body2" gutterBottom>{tAccounting('closing.ending.openTemporaryHint')}</Typography>
          {preview.open_temporary.map((row, index) => (
            <Typography key={index} variant="body2">
              {accountLabel(row.account_id)}
              {centersLabel(row.center_ids) && ` (${centersLabel(row.center_ids)})`} · {currencyAbr(row.currency_id)}:{' '}
              {formatAmount(row.base_balance, mainDigits)}
            </Typography>
          ))}
        </Alert>
      )}

      {!preview.balanced && <Alert severity="error">{tAccounting('closing.ending.unbalanced')}</Alert>}

      {preview.lines.length === 0 ? (
        <Alert severity="info">{tAccounting('closing.ending.nothingToCarry')}</Alert>
      ) : (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            {tAccounting('closing.ending.linesTitle', { count: preview.lines.length })}
          </Typography>
          <ClosingLinesTable orgId={orgId} lines={preview.lines} total={preview.total} />
        </Box>
      )}

      <ClosingLineDescriptions
        state={state}
        date={state.fiscal_year.finish_date}
        nextFiscalYearName={state.next_fiscal_year?.name}
        kinds={[{ kind: 'ending', sample: preview.lines[0] }]}
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
        {!preview.postable && (
          <Typography variant="body2" color="text.secondary">{tAccounting('closing.tempClosing.resolveProblems')}</Typography>
        )}
        <Button variant="contained" onClick={handlePost} disabled={posting || !preview.postable}
          startIcon={posting ? <CircularProgress size={16} color="inherit" /> : null}>
          {tAccounting(preview.lines.length === 0 ? 'closing.tempClosing.continue' : 'closing.ending.post')}
        </Button>
      </Box>
    </Box>
  );
};
