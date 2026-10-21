import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useTranslation } from 'react-i18next';
import { useOpenPage } from '../../../../components/tabs/useOpenPage';
import { useToast } from '../../../../contexts/ToastContext';
import { useConfirm } from '../../../../contexts/confirmContext';
import { usePermissionCodes } from '../../../../hooks/usePermissionCodes';
import { apiErrorMessage } from '../../../../utils/apiErrorMessage';
import { PERMISSION_CODES } from '../../../app/sidebarConfig';
import { fiscalYearsApi } from '../../../fiscalYears/fiscalYearsApi';
import { journalEntriesApi } from '../../journalEntries/journalEntriesApi';
import {
  useApproveAllEntriesMutation,
  useStartClosingMutation,
  type ApproveAllResult,
  type ClosingState,
} from '../fiscalYearClosingApi';

interface Props {
  state: ClosingState;
}

interface CheckProps {
  ok: boolean;
  title: string;
  detail?: React.ReactNode;
  action?: React.ReactNode;
}

const Check = ({ ok, title, detail, action }: CheckProps) => (
  <ListItem alignItems="flex-start" secondaryAction={action} sx={{ pr: action ? 24 : 2 }}>
    <ListItemIcon sx={{ mt: 0.5 }}>
      {ok ? <CheckCircleOutlineIcon color="success" /> : <ErrorOutlineIcon color="error" />}
    </ListItemIcon>
    <ListItemText primary={title} secondary={detail} secondaryTypographyProps={{ component: 'div' }} />
  </ListItem>
);

/** Step 1: what must be resolved before the year can be locked for closing. */
export const ReadinessStep = ({ state }: Props) => {
  const { t: tAccounting } = useTranslation('accounting');
  const { t } = useTranslation('shared');
  const { organizationId } = useParams<{ organizationId: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const dispatch = useDispatch();
  const { openPage, openJournalEntry } = useOpenPage(orgId);
  const { showSuccess, showError, showWarning } = useToast();
  const confirm = useConfirm();
  const { has } = usePermissionCodes(orgId);
  const canApprove = has(PERMISSION_CODES.ACCOUNTING_APPROVE_JOURNAL_ENTRIES);
  const [approveAll, { isLoading: approving }] = useApproveAllEntriesMutation();
  const [startClosing, { isLoading: starting }] = useStartClosingMutation();
  const [failures, setFailures] = useState<ApproveAllResult['failed']>([]);

  const readiness = state.readiness;
  if (!readiness) return null;
  const blocked = (key: string) => readiness.blockers.includes(key as never);
  const fiscalYearId = state.fiscal_year.id;

  // The journal entries list, showing only entries in this state.
  const openEntriesInState = (state: 'draft' | 'booked') =>
    openPage('journal-entries', tAccounting('closing.readiness.entriesTabTitle', { state: tAccounting(state) }),
      `accounting/journal-entries?state=${state}`);


  const handleApproveAll = async () => {
    const ok = await confirm({
      title: tAccounting('closing.readiness.approveAllTitle'),
      message: tAccounting('closing.readiness.approveAllMessage', { count: readiness.booked_count }),
      confirmText: tAccounting('closing.readiness.approveAll'),
      confirmColor: 'primary',
    });
    if (!ok) return;
    try {
      const result = await approveAll({ organizationId: orgId, fiscalYearId }).unwrap();
      setFailures(result.failed);
      dispatch(journalEntriesApi.util.invalidateTags(['JournalEntry']));
      if (result.failed.length) {
        showWarning(tAccounting('closing.readiness.approvedWithFailures', { approved: result.approved, failed: result.failed.length }));
      } else {
        showSuccess(tAccounting('closing.readiness.approved', { count: result.approved }));
      }
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('closing.actionFailed'));
    }
  };

  const handleStart = async () => {
    const ok = await confirm({
      title: tAccounting('closing.readiness.startTitle'),
      message: tAccounting('closing.readiness.startMessage', { name: state.fiscal_year.name }),
      confirmText: tAccounting('closing.readiness.start'),
      confirmColor: 'primary',
    });
    if (!ok) return;
    try {
      await startClosing({ organizationId: orgId, fiscalYearId }).unwrap();
      dispatch(fiscalYearsApi.util.invalidateTags(['FiscalYear']));
      dispatch(journalEntriesApi.util.invalidateTags(['JournalEntry']));
      showSuccess(tAccounting('closing.readiness.started'));
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('closing.actionFailed'));
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">{tAccounting('closing.readiness.intro')}</Typography>

      <List disablePadding>
        <Check
          ok={!blocked('drafts')}
          title={tAccounting('closing.readiness.drafts', { count: readiness.drafts_count })}
          detail={
            readiness.drafts_count > 0 && (
              <Box>
                <Typography variant="body2">{tAccounting('closing.readiness.draftsHint')}</Typography>
                <Link component="button" variant="body2" onClick={() => openEntriesInState('draft')}>
                  {tAccounting('closing.readiness.showDrafts', { count: readiness.drafts_count })}
                </Link>
              </Box>
            )
          }
        />
        <Check
          ok={!blocked('unapproved_entries')}
          title={tAccounting('closing.readiness.booked', { count: readiness.booked_count })}
          detail={readiness.booked_count > 0 && (
            <Box>
              {!canApprove && <Typography variant="body2">{tAccounting('closing.readiness.needApprovePermission')}</Typography>}
              <Link component="button" variant="body2" onClick={() => openEntriesInState('booked')}>
                {tAccounting('closing.readiness.showBooked', { count: readiness.booked_count })}
              </Link>
            </Box>
          )}
          action={
            readiness.booked_count > 0 && canApprove ? (
              <Button size="small" variant="outlined" onClick={handleApproveAll} disabled={approving}
                startIcon={approving ? <CircularProgress size={14} /> : null}>
                {tAccounting('closing.readiness.approveAll')}
              </Button>
            ) : undefined
          }
        />
        <Check
          ok={!blocked('no_next_fiscal_year') && !blocked('next_fiscal_year_not_open')}
          title={
            readiness.next_fiscal_year
              ? tAccounting('closing.readiness.nextYear', { name: readiness.next_fiscal_year.name })
              : tAccounting('closing.readiness.noNextYear')
          }
          detail={blocked('next_fiscal_year_not_open') ? tAccounting('closing.readiness.nextYearNotOpen') : undefined}
          action={
            !readiness.next_fiscal_year ? (
              <Button size="small" variant="outlined" onClick={() => openPage('fiscal-years', t('menu.fiscalYears'), 'fiscal-years')}>
                {tAccounting('closing.readiness.createNextYear')}
              </Button>
            ) : undefined
          }
        />
        {readiness.previous_fiscal_year && (
          <Check
            ok={!blocked('previous_fiscal_year_open')}
            title={tAccounting('closing.readiness.previousYear', { name: readiness.previous_fiscal_year.name })}
            detail={blocked('previous_fiscal_year_open') ? tAccounting('closing.readiness.previousYearOpen') : undefined}
          />
        )}
        <Check
          ok={!blocked('settings_incomplete')}
          title={
            state.settings
              ? tAccounting('closing.readiness.method', {
                  method: tAccounting(`closingSettings.methods.${state.settings.closing_method}`),
                })
              : tAccounting('closing.readiness.settings')
          }
          detail={readiness.settings_errors.length > 0 ? readiness.settings_errors.join(' ') : undefined}
          action={
            <Button size="small" variant="text"
              onClick={() => openPage('accounting-settings', t('menu.accountingSettings'), 'accounting/settings')}>
              {tAccounting('closing.readiness.openSettings')}
            </Button>
          }
        />
      </List>

      {failures.length > 0 && (
        <Alert severity="warning">
          <Typography variant="body2" gutterBottom>{tAccounting('closing.readiness.approveFailures')}</Typography>
          {failures.map((failure) => (
            <Box key={failure.id}>
              <Link component="button" variant="body2" onClick={() => openJournalEntry(failure)}>
                #{failure.no} ({failure.date})
              </Link>
              : {failure.errors.join(' ')}
            </Box>
          ))}
        </Alert>
      )}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 }}>
        {!readiness.ready && (
          <Typography variant="body2" color="text.secondary">{tAccounting('closing.readiness.notReady')}</Typography>
        )}
        <Button variant="contained" onClick={handleStart} disabled={!readiness.ready || starting}
          startIcon={starting ? <CircularProgress size={16} color="inherit" /> : null}>
          {tAccounting('closing.readiness.start')}
        </Button>
      </Box>
    </Box>
  );
};
