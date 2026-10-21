import { useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Container,
  Link,
  List,
  ListItem,
  ListItemText,
  Paper,
  Step,
  StepLabel,
  Stepper,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useTabLoading } from '../../../components/tabs/TabLoadingContext';
import { useOpenPage } from '../../../components/tabs/useOpenPage';
import { useIsTabActive } from '../../../components/tabs/useIsTabActive';
import { useConfirm } from '../../../contexts/confirmContext';
import { useToast } from '../../../contexts/ToastContext';
import { useActiveFiscalYear } from '../../../hooks/useActiveFiscalYear';
import { apiErrorMessage } from '../../../utils/apiErrorMessage';
import { fiscalYearsApi } from '../../fiscalYears/fiscalYearsApi';
import { journalEntriesApi } from '../journalEntries/journalEntriesApi';
import {
  useCancelClosingMutation,
  useGetClosingStateQuery,
  useReopenFullyMutation,
  useRollbackClosingStepMutation,
  type ClosingState,
} from './fiscalYearClosingApi';
import { ReadinessStep } from './steps/ReadinessStep';
import { RevaluationStep } from './steps/RevaluationStep';
import { RenumberStep } from './steps/RenumberStep';
import { TempClosingStep } from './steps/TempClosingStep';
import { EndingStep } from './steps/EndingStep';
import { BeginningStep } from './steps/BeginningStep';
import { FinalizedStep } from './steps/FinalizedStep';

/** Steps the wizard can go back from (see Closing::Rollback). */
const ROLLBACK_STEPS = ['revaluation', 'temp_closing', 'ending', 'beginning', 'finalized'];

const StepContent = ({ state }: { state: ClosingState }) => {
  // The step's preview couldn't be built; rolling back or canceling stays possible.
  if (state.step_error) return <Alert severity="error">{state.step_error}</Alert>;

  switch (state.current_step) {
    case 'readiness':
      return <ReadinessStep state={state} />;
    case 'renumber':
      return <RenumberStep state={state} />;
    case 'revaluation':
      return <RevaluationStep state={state} />;
    case 'temp_closing':
      return <TempClosingStep state={state} />;
    case 'ending':
      return <EndingStep state={state} />;
    case 'beginning':
      return <BeginningStep state={state} />;
    case 'finalized':
      return <FinalizedStep state={state} />;
    default:
      return null;
  }
};

/**
 * Year-end closing wizard. Opened for a fiscal year (:fiscalYearId) or,
 * without one, for the active fiscal year. Progress is stored on the
 * fiscal year, so the wizard resumes where it was left.
 */
export const FiscalYearClosingPage = () => {
  const { t: tAccounting } = useTranslation('accounting');
  const { organizationId, fiscalYearId: fiscalYearParam } = useParams<{ organizationId: string; fiscalYearId?: string }>();
  const orgId = parseInt(organizationId || '0', 10);
  const { activeFiscalYearId } = useActiveFiscalYear(orgId);
  const fiscalYearId = fiscalYearParam ? parseInt(fiscalYearParam, 10) : activeFiscalYearId;
  const dispatch = useDispatch();
  const confirm = useConfirm();
  const { showSuccess, showError } = useToast();

  // Readiness depends on data changed elsewhere (entries, fiscal years,
  // settings), so the state is fetched fresh when the page opens and again
  // whenever its tab is shown or the window regains focus.
  const { data: state, isLoading, isFetching, error, refetch } = useGetClosingStateQuery(
    { organizationId: orgId, fiscalYearId: fiscalYearId ?? 0 },
    { skip: !orgId || !fiscalYearId, refetchOnMountOrArgChange: true }
  );
  useTabLoading(isLoading || isFetching);
  const tabActive = useIsTabActive();
  const wasActive = useRef(tabActive);
  useEffect(() => {
    if (tabActive && !wasActive.current && orgId && fiscalYearId) refetch();
    wasActive.current = tabActive;
  }, [tabActive, orgId, fiscalYearId, refetch]);
  useEffect(() => {
    if (!orgId || !fiscalYearId) return undefined;
    const onFocus = () => { if (document.visibilityState === 'visible') refetch(); };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [orgId, fiscalYearId, refetch]);
  const [cancelClosing, { isLoading: canceling }] = useCancelClosingMutation();
  const [rollbackStep, { isLoading: rollingBack }] = useRollbackClosingStepMutation();
  const [reopenFully, { isLoading: reopening }] = useReopenFullyMutation();
  const { openJournalEntry } = useOpenPage(orgId);

  if (!fiscalYearId) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="info">{tAccounting('activeFiscalYearRequired')}</Alert>
      </Container>
    );
  }
  if (error) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error">{apiErrorMessage(error) || tAccounting('closing.loadFailed')}</Alert>
      </Container>
    );
  }
  if (isLoading || !state) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const activeIndex = state.steps.indexOf(state.current_step);
  const isClosing = state.fiscal_year.status === 'closing';
  const isClosed = state.fiscal_year.status === 'closed';
  const canCancel = isClosing && state.entries.length === 0;
  const canGoBack = (isClosing || isClosed) && ROLLBACK_STEPS.includes(state.current_step);
  const canReopenFully = (isClosing || isClosed) && state.entries.length > 0;
  const busy = rollingBack || canceling || reopening;

  const afterReopen = () => {
    dispatch(fiscalYearsApi.util.invalidateTags(['FiscalYear']));
    dispatch(journalEntriesApi.util.invalidateTags(['JournalEntry']));
  };


  const handleRollback = async () => {
    const ok = await confirm({
      title: tAccounting('closing.rollback.title'),
      message: tAccounting(`closing.rollback.messages.${state.current_step}`),
      confirmText: tAccounting('closing.rollback.confirm'),
      confirmColor: 'warning',
    });
    if (!ok) return;
    try {
      await rollbackStep({ organizationId: orgId, fiscalYearId: state.fiscal_year.id }).unwrap();
      afterReopen();
      showSuccess(tAccounting(isClosed ? 'closing.rollback.reopened' : 'closing.rollback.done'));
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('closing.actionFailed'));
    }
  };

  const handleReopenFully = async () => {
    const ok = await confirm({
      title: tAccounting('closing.rollback.reopenFullyTitle'),
      message: tAccounting('closing.rollback.reopenFullyMessage', { name: state.fiscal_year.name }),
      confirmText: tAccounting('closing.rollback.reopenFully'),
      confirmColor: 'error',
    });
    if (!ok) return;
    try {
      await reopenFully({ organizationId: orgId, fiscalYearId: state.fiscal_year.id }).unwrap();
      afterReopen();
      showSuccess(tAccounting('closing.canceled'));
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('closing.actionFailed'));
    }
  };

  const handleCancel = async () => {
    const ok = await confirm({
      title: tAccounting('closing.cancelTitle'),
      message: tAccounting('closing.cancelMessage'),
      confirmText: tAccounting('closing.cancel'),
      confirmColor: 'error',
    });
    if (!ok) return;
    try {
      await cancelClosing({ organizationId: orgId, fiscalYearId: state.fiscal_year.id }).unwrap();
      dispatch(fiscalYearsApi.util.invalidateTags(['FiscalYear']));
      dispatch(journalEntriesApi.util.invalidateTags(['JournalEntry']));
      showSuccess(tAccounting('closing.canceled'));
    } catch (err) {
      showError(apiErrorMessage(err) || tAccounting('closing.actionFailed'));
    }
  };

  return (
    <Container maxWidth="lg" sx={{ py: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            {tAccounting('closing.title', { name: state.fiscal_year.name })}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {state.fiscal_year.start_date} – {state.fiscal_year.finish_date}
            </Typography>
            <Chip size="small" label={tAccounting(`closing.statuses.${state.fiscal_year.status}`)}
              color={state.fiscal_year.status === 'closed' ? 'success' : state.fiscal_year.status === 'closing' ? 'warning' : 'default'} />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {canGoBack && (
            <Button color="warning" onClick={handleRollback} disabled={busy}>
              {tAccounting(isClosed ? 'closing.rollback.reopen' : 'closing.rollback.button')}
            </Button>
          )}
          {canReopenFully && (
            <Button color="error" onClick={handleReopenFully} disabled={busy}>{tAccounting('closing.rollback.reopenFully')}</Button>
          )}
          {canCancel && (
            <Button color="error" onClick={handleCancel} disabled={busy}>{tAccounting('closing.cancel')}</Button>
          )}
        </Box>
      </Box>

      <Paper sx={{ p: 2 }}>
        <Stepper activeStep={activeIndex} alternativeLabel>
          {state.steps.map((step) => (
            <Step key={step} completed={state.steps.indexOf(step) < activeIndex || state.fiscal_year.status === 'closed'}>
              <StepLabel>{tAccounting(`closing.stepLabels.${step}`)}</StepLabel>
            </Step>
          ))}
        </Stepper>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <StepContent state={state} />
      </Paper>

      {state.entries.length > 0 && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle1">{tAccounting('closing.postedEntries')}</Typography>
          <List dense disablePadding>
            {state.entries.map((entry) => (
              <ListItem key={entry.id} disableGutters>
                <ListItemText
                  primary={
                    <Link component="button" variant="body2" onClick={() => openJournalEntry(entry)}>
                      #{entry.no} · {tAccounting(`closing.entryTypes.${entry.entry_type}`)}
                    </Link>
                  }
                  secondary={`${entry.date} · ${Number(entry.debit).toLocaleString()}`}
                />
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Container>
  );
};
