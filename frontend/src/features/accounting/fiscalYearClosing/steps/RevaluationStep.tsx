import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import { useOpenPage } from '../../../../components/tabs/useOpenPage';
import { useToast } from '../../../../contexts/ToastContext';
import { useConfirm } from '../../../../contexts/confirmContext';
import { usePermissionCodes } from '../../../../hooks/usePermissionCodes';
import { apiErrorMessage } from '../../../../utils/apiErrorMessage';
import { PERMISSION_CODES } from '../../../app/sidebarConfig';
import { journalEntriesApi } from '../../journalEntries/journalEntriesApi';
import {
  useChangeRevaluationKindMutation,
  useCreateCurrencyRevaluationMutation,
  useDeleteCurrencyRevaluationMutation,
} from '../../currencyRevaluations/currencyRevaluationsApi';
import {
  fiscalYearClosingApi,
  useAcknowledgeRevaluationMutation,
  useCompleteRevaluationMutation,
  type ClosingState,
  type RevaluationCheckItem,
  type RevaluationCheckTemporary,
} from '../fiscalYearClosingApi';
import { formatAmount, useClosingLabels } from '../useClosingLabels';
import { RateWithInverse } from '../../exchangeRates/components/RateWithInverse';

interface Props {
  state: ClosingState;
}

/**
 * Step 2: foreign currency balances must be final as of the last day.
 * Temporary revaluations must be made permanent or removed; what a
 * year-end permanent revaluation would still post is revalued (in the
 * revaluation page) or acknowledged.
 */
export const RevaluationStep = ({ state }: Props) => {
  const { t: tAccounting } = useTranslation('accounting');
  const { t } = useTranslation('shared');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const dispatch = useDispatch();
  const { openPage, openJournalEntry } = useOpenPage(orgId);
  const { showSuccess, showError } = useToast();
  const confirm = useConfirm();
  const { has } = usePermissionCodes(orgId);
  const canRevalue = has(PERMISSION_CODES.ACCOUNTING_REVALUE_CURRENCIES);

  const { mainDigits, mainCurrencyId, accountLabel, centerLabel, centerLevels, currencyAbr, currencyDigits } = useClosingLabels(orgId);
  const levels = Array.from({ length: centerLevels }, (_, i) => i);

  const [createRevaluation, { isLoading: creating }] = useCreateCurrencyRevaluationMutation();
  const [changeKind, { isLoading: changingKind }] = useChangeRevaluationKindMutation();
  const [deleteRevaluation, { isLoading: deleting }] = useDeleteCurrencyRevaluationMutation();
  const [acknowledge, { isLoading: acknowledging }] = useAcknowledgeRevaluationMutation();
  const [complete, { isLoading: completing }] = useCompleteRevaluationMutation();
  const busy = creating || changingKind || deleting || acknowledging || completing;

  const check = state.revaluation_check;
  if (!check) return null;
  const fiscalYearId = state.fiscal_year.id;
  const hasTemporaries = check.temporaries.length > 0;
  const lapsed = !!check.acknowledgment && !check.acknowledged;

  const openRevaluation = (revaluation: { id: number; as_of_date: string }) =>
    openPage('currency-revaluation', tAccounting('revaluations.tabTitle', { date: revaluation.as_of_date }),
      `accounting/currency-revaluations/${revaluation.id}`);

  const refresh = () => dispatch(fiscalYearClosingApi.util.invalidateTags([{ type: 'FiscalYearClosing', id: fiscalYearId }]));

  const afterEntriesChanged = () => dispatch(journalEntriesApi.util.invalidateTags(['JournalEntry']));

  const handleMakePermanent = async (revaluation: RevaluationCheckTemporary) => {
    const ok = await confirm({
      title: tAccounting('revaluations.make.permanent'),
      message: tAccounting('revaluations.makeMessage.permanent'),
      confirmText: tAccounting('revaluations.make.permanent'),
      confirmColor: 'primary',
    });
    if (!ok) return;
    try {
      await changeKind({ organizationId: orgId, id: revaluation.id, kind: 'permanent' }).unwrap();
      showSuccess(tAccounting('revaluations.kindChanged'));
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('revaluations.saveFailed'));
    }
  };

  const handleRemove = async (revaluation: RevaluationCheckTemporary) => {
    const ok = await confirm({
      title: tAccounting('revaluations.deleteTitle'),
      message: tAccounting('revaluations.deletePostedMessage'),
      confirmText: t('commonActions.delete'),
      confirmColor: 'error',
    });
    if (!ok) return;
    try {
      await deleteRevaluation({ organizationId: orgId, id: revaluation.id }).unwrap();
      afterEntriesChanged();
      showSuccess(tAccounting('revaluations.deleted'));
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('revaluations.deleteFailed'));
    }
  };

  const handleRevalueNow = async () => {
    try {
      const created = await createRevaluation({ organizationId: orgId, asOfDate: check.as_of_date, scope: {}, kind: 'permanent' }).unwrap();
      openRevaluation(created);
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('revaluations.saveFailed'));
    }
  };

  const handleAcknowledge = async () => {
    const ok = await confirm({
      title: tAccounting('closing.revaluation.acknowledgeTitle'),
      message: tAccounting('closing.revaluation.acknowledgeMessage', {
        count: check.unrevalued.length + check.missing_rates.length + check.other_exclusions.length,
      }),
      confirmText: tAccounting('closing.revaluation.acknowledge'),
      confirmColor: 'primary',
    });
    if (!ok) return;
    try {
      await acknowledge({ organizationId: orgId, fiscalYearId }).unwrap();
      showSuccess(tAccounting('closing.revaluation.acknowledged'));
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('closing.actionFailed'));
    }
  };

  const handleContinue = async () => {
    try {
      await complete({ organizationId: orgId, fiscalYearId }).unwrap();
      showSuccess(tAccounting('closing.revaluation.completed'));
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('closing.actionFailed'));
    }
  };

  const balanceTable = (items: RevaluationCheckItem[], { withRate, withReason }: { withRate: boolean; withReason?: boolean }) => (
    <TableContainer sx={{ maxHeight: 360 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>{tAccounting('revaluations.account')}</TableCell>
            {levels.map((i) => (
              <TableCell key={i}>{tAccounting('revaluations.centerLevel', { level: i + 1 })}</TableCell>
            ))}
            <TableCell>{tAccounting('revaluations.currency')}</TableCell>
            <TableCell align="right">{tAccounting('revaluations.currencyBalance')}</TableCell>
            <TableCell align="right">{tAccounting('revaluations.bookBalance')}</TableCell>
            {withRate && <TableCell align="right">{tAccounting('revaluations.rate')}</TableCell>}
            {withRate && <TableCell align="right">{tAccounting('revaluations.revaluedBalance')}</TableCell>}
            {withRate && <TableCell align="right">{tAccounting('revaluations.difference')}</TableCell>}
            {withReason && <TableCell>{tAccounting('closing.revaluation.reason')}</TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {items.map((item) => (
            <TableRow key={`${item.account_id}-${item.currency_id}-${item.center_ids.join('-')}`}>
              <TableCell>{accountLabel(item.account_id)}</TableCell>
              {levels.map((i) => <TableCell key={i}>{centerLabel(item.center_ids[i])}</TableCell>)}
              <TableCell>{currencyAbr(item.currency_id)}</TableCell>
              <TableCell align="right">{formatAmount(item.currency_balance, currencyDigits(item.currency_id))}</TableCell>
              <TableCell align="right">{formatAmount(item.book_base_balance, mainDigits)}</TableCell>
              {withRate && (
                <TableCell align="right">
                  {item.rate ? <RateWithInverse rate={item.rate} currency={currencyAbr(item.currency_id)} quote={currencyAbr(mainCurrencyId ?? 0)} /> : ''}
                </TableCell>
              )}
              {withRate && <TableCell align="right">{formatAmount(item.revalued_base_balance, mainDigits)}</TableCell>}
              {withRate && (
                <TableCell align="right"
                  sx={{ color: Number(item.difference) > 0 ? 'success.main' : Number(item.difference) < 0 ? 'error.main' : undefined }}>
                  {formatAmount(item.difference, mainDigits)}
                </TableCell>
              )}
              {withReason && (
                <TableCell>{item.excluded_reason ? tAccounting(`revaluations.excludedReasons.${item.excluded_reason}`) : ''}</TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
        <Typography variant="body2" color="text.secondary">
          {tAccounting('closing.revaluation.intro', { date: check.as_of_date })}
        </Typography>
        <Button size="small" startIcon={<RefreshIcon />} onClick={refresh} disabled={busy}>
          {tAccounting('closing.revaluation.refresh')}
        </Button>
      </Box>

      {hasTemporaries && (
        <Alert severity="error">
          <AlertTitle>{tAccounting('closing.revaluation.temporariesTitle', { count: check.temporaries.length })}</AlertTitle>
          <Typography variant="body2" gutterBottom>{tAccounting('closing.revaluation.temporariesHint')}</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>{tAccounting('revaluations.asOfDate')}</TableCell>
                <TableCell>{tAccounting('revaluations.journalEntry')}</TableCell>
                <TableCell align="right">{tAccounting('revaluations.totalDifference')}</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {check.temporaries.map((revaluation) => (
                <TableRow key={revaluation.id}>
                  <TableCell>
                    <Link component="button" variant="body2" onClick={() => openRevaluation(revaluation)}>
                      {revaluation.as_of_date}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {revaluation.journal_entry_id && (
                      <Link component="button" variant="body2"
                        onClick={() => openJournalEntry({ id: revaluation.journal_entry_id as number, ref: revaluation.journal_entry_ref })}>
                        #{revaluation.journal_entry_no}
                      </Link>
                    )}
                  </TableCell>
                  <TableCell align="right">{formatAmount(revaluation.total_difference, mainDigits)}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {canRevalue && (
                      <>
                        <Button size="small" onClick={() => handleMakePermanent(revaluation)} disabled={busy}>
                          {tAccounting('revaluations.make.permanent')}
                        </Button>
                        <Button size="small" color="error" onClick={() => handleRemove(revaluation)} disabled={busy}>
                          {t('commonActions.delete')}
                        </Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Alert>
      )}

      {check.clean && !hasTemporaries && (
        <Alert severity="success">{tAccounting('closing.revaluation.clean', { date: check.as_of_date })}</Alert>
      )}

      {check.unrevalued.length > 0 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 2 }}>
            <Box>
              <Typography variant="subtitle1">
                {tAccounting('closing.revaluation.unrevaluedTitle', { count: check.unrevalued.length })}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {tAccounting('revaluations.totalDifference')}: {formatAmount(check.total_difference, mainDigits)}
              </Typography>
            </Box>
            {canRevalue && (
              <Button variant="outlined" onClick={handleRevalueNow} disabled={busy || hasTemporaries}
                startIcon={creating ? <CircularProgress size={14} /> : null}>
                {tAccounting('closing.revaluation.revalueNow')}
              </Button>
            )}
          </Box>
          {balanceTable(check.unrevalued, { withRate: true })}
          {!canRevalue && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {tAccounting('closing.revaluation.needRevaluePermission')}
            </Typography>
          )}
        </Box>
      )}

      {check.missing_rates.length > 0 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, gap: 2 }}>
            <Typography variant="subtitle1">
              {tAccounting('closing.revaluation.missingRatesTitle', { count: check.missing_rates.length })}
            </Typography>
            <Button variant="text" onClick={() => openPage('exchange-rates', t('menu.exchangeRates'), 'accounting/exchange-rates')}>
              {tAccounting('closing.revaluation.openExchangeRates')}
            </Button>
          </Box>
          {balanceTable(check.missing_rates, { withRate: false })}
        </Box>
      )}

      {check.other_exclusions.length > 0 && (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            {tAccounting('closing.revaluation.otherExclusionsTitle', { count: check.other_exclusions.length })}
          </Typography>
          {balanceTable(check.other_exclusions, { withRate: true, withReason: true })}
        </Box>
      )}

      {check.acknowledged && check.acknowledgment && (
        <Alert severity="info">
          {tAccounting('closing.revaluation.acknowledgedAt', { at: new Date(check.acknowledgment.at).toLocaleString() })}
        </Alert>
      )}
      {lapsed && <Alert severity="warning">{tAccounting('closing.revaluation.acknowledgmentLapsed')}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
        {!check.passes && (
          <Typography variant="body2" color="text.secondary">
            {tAccounting(hasTemporaries ? 'closing.revaluation.resolveTemporaries' : 'closing.revaluation.revalueOrAcknowledge')}
          </Typography>
        )}
        {!check.clean && !check.acknowledged && (
          <Button variant="outlined" onClick={handleAcknowledge} disabled={busy || hasTemporaries}
            startIcon={acknowledging ? <CircularProgress size={14} /> : null}>
            {tAccounting('closing.revaluation.acknowledge')}
          </Button>
        )}
        <Button variant="contained" onClick={handleContinue} disabled={busy || !check.passes}
          startIcon={completing ? <CircularProgress size={16} color="inherit" /> : null}>
          {tAccounting('closing.revaluation.continue')}
        </Button>
      </Box>
    </Box>
  );
};
