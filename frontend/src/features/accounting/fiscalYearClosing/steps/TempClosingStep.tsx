import { useNavigate, useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  CircularProgress,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useTabManager } from '../../../../components/tabs/useTabManager';
import { useToast } from '../../../../contexts/ToastContext';
import { useConfirm } from '../../../../contexts/confirmContext';
import { apiErrorMessage } from '../../../../utils/apiErrorMessage';
import { journalEntriesApi } from '../../journalEntries/journalEntriesApi';
import { fiscalYearClosingApi, usePostTempClosingMutation, type ClosingState } from '../fiscalYearClosingApi';
import { ClosingLinesTable } from '../components/ClosingLinesTable';
import { ClosingLineDescriptions } from '../components/ClosingLineDescriptions';
import { formatAmount, useClosingLabels } from '../useClosingLabels';

interface Props {
  state: ClosingState;
}

/**
 * Step 3: preview and post the entries that close the income statement
 * accounts into retained earnings, the income summary or the current year
 * profit account (per the closing method).
 */
export const TempClosingStep = ({ state }: Props) => {
  const { t: tAccounting } = useTranslation('accounting');
  const { t } = useTranslation('shared');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { openTab } = useTabManager();
  const { showSuccess, showError, showWarning } = useToast();
  const confirm = useConfirm();
  const { mainDigits, accountLabel, centersLabel, currencyAbr } = useClosingLabels(orgId);
  const [postTempClosing, { isLoading: posting }] = usePostTempClosingMutation();

  const preview = state.temp_closing;
  if (!preview) return null;
  const fiscalYearId = state.fiscal_year.id;
  const net = Number(preview.net_result);

  const handlePost = async () => {
    if (preview.entries.length > 0) {
      const ok = await confirm({
        title: tAccounting('closing.tempClosing.postTitle'),
        message: tAccounting('closing.tempClosing.postMessage', { count: preview.entries.length, date: state.fiscal_year.finish_date }),
        confirmText: tAccounting('closing.tempClosing.post'),
        confirmColor: 'primary',
      });
      if (!ok) return;
    }
    try {
      await postTempClosing({ organizationId: orgId, fiscalYearId, checksum: preview.checksum }).unwrap();
      dispatch(journalEntriesApi.util.invalidateTags(['JournalEntry']));
      showSuccess(tAccounting('closing.tempClosing.posted'));
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 409) {
        dispatch(fiscalYearClosingApi.util.invalidateTags([{ type: 'FiscalYearClosing', id: fiscalYearId }]));
        showWarning(apiErrorMessage(err) || tAccounting('closing.actionFailed'));
      } else {
        showError(apiErrorMessage(err) || tAccounting('closing.actionFailed'));
      }
    }
  };

  const openSettings = () => {
    const path = `/app/organizations/${orgId}/accounting/settings`;
    openTab('accounting-settings', t('menu.accountingSettings'), path);
    navigate(path);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {tAccounting(`closing.tempClosing.intro.${preview.closing_method}`, { date: state.fiscal_year.finish_date })}
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="subtitle1">{tAccounting('closing.tempClosing.netResult')}:</Typography>
        <Chip
          label={`${tAccounting(net >= 0 ? 'closing.tempClosing.profit' : 'closing.tempClosing.loss')} ${formatAmount(String(Math.abs(net)), mainDigits)}`}
          color={net > 0 ? 'success' : net < 0 ? 'error' : 'default'}
        />
      </Box>

      {preview.problems.length > 0 && (
        <Alert severity="error" action={<Button color="inherit" size="small" onClick={openSettings}>{tAccounting('closing.readiness.openSettings')}</Button>}>
          <AlertTitle>{tAccounting('closing.tempClosing.problemsTitle', { count: preview.problems.length })}</AlertTitle>
          <Typography variant="body2" gutterBottom>{tAccounting('closing.tempClosing.centerMismatchHint')}</Typography>
          {preview.problems.map((problem, index) => (
            <Typography key={index} variant="body2">
              {accountLabel(problem.account_id)}
              {centersLabel(problem.center_ids) && ` (${centersLabel(problem.center_ids)})`} · {currencyAbr(problem.currency_id)}
              {' → '}{accountLabel(problem.target_account_id)}
            </Typography>
          ))}
        </Alert>
      )}

      {preview.entries.length === 0 ? (
        <Alert severity="info">{tAccounting('closing.tempClosing.nothingToClose')}</Alert>
      ) : (
        preview.entries.map((entry) => (
          <Box key={entry.kind}>
            <Typography variant="subtitle1" gutterBottom>
              {tAccounting(`closing.tempClosing.kinds.${entry.kind}`, { account: accountLabel(entry.target_account_id) })}
            </Typography>
            <ClosingLinesTable orgId={orgId} lines={entry.lines} total={entry.total} highlightAccountId={entry.target_account_id} />
          </Box>
        ))
      )}

      <ClosingLineDescriptions
        state={state}
        date={state.fiscal_year.finish_date}
        nextFiscalYearName={state.next_fiscal_year?.name}
        kinds={[
          { kind: 'closing', sample: preview.entries.flatMap((e) => e.lines.filter((l) => l.account_id !== e.target_account_id))[0] },
          { kind: 'closing_offset', sample: preview.entries.flatMap((e) => e.lines.filter((l) => l.account_id === e.target_account_id))[0] },
        ]}
      />

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
        {!preview.postable && (
          <Typography variant="body2" color="text.secondary">{tAccounting('closing.tempClosing.resolveProblems')}</Typography>
        )}
        <Button variant="contained" onClick={handlePost} disabled={posting || !preview.postable}
          startIcon={posting ? <CircularProgress size={16} color="inherit" /> : null}>
          {tAccounting(preview.entries.length === 0 ? 'closing.tempClosing.continue' : 'closing.tempClosing.post')}
        </Button>
      </Box>
    </Box>
  );
};
